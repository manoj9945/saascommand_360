import getpass
import json

import psycopg
from kafka import KafkaConsumer


KAFKA_TOPIC = "saas-events"
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"


# ---------------------------------------------------------
# PostgreSQL connection
# ---------------------------------------------------------

password = getpass.getpass("Enter PostgreSQL password: ")

db_conn = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="saascommand_360",
    user="postgres",
    password=password,
)


# ---------------------------------------------------------
# Kafka consumer
# ---------------------------------------------------------

consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    group_id="saascommand-consumer",
    auto_offset_reset="earliest",
    enable_auto_commit=False,
    value_deserializer=lambda value: json.loads(value.decode("utf-8")),
)


print("Consumer started.")
print("Waiting continuously for events...")
print("Press Ctrl+C to stop.\n")


try:

    for message in consumer:

        event = message.value

        print("\nEvent received from Kafka:")
        print(event)

        try:

            with db_conn.cursor() as cur:

                # -------------------------------------------------
                # 1. Store event in Bronze
                # -------------------------------------------------

                cur.execute(
                    """
                    INSERT INTO bronze.live_events (
                        event_id,
                        event_type,
                        customer_id,
                        user_id,
                        feature,
                        event_timestamp,
                        raw_event
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (event_id) DO NOTHING
                    RETURNING event_id;
                    """,
                    (
                        event["event_id"],
                        event["event_type"],
                        event.get("customer_id"),
                        event.get("user_id"),
                        event.get("feature"),
                        event["timestamp"],
                        json.dumps(event),
                    ),
                )

                inserted_event = cur.fetchone()


                # -------------------------------------------------
                # 2. Live business rule
                # -------------------------------------------------
                # AI Assistant usage is treated as a product
                # adoption signal that may indicate an
                # expansion opportunity.
                # -------------------------------------------------

                if inserted_event and event.get("feature") == "AI_Assistant":

                    cur.execute(
                        """
                        INSERT INTO analytics.alerts (
                            customer_id,
                            alert_type,
                            severity,
                            owner,
                            status,
                            reason,
                            recommended_action,
                            source,
                            metadata
                        )
                        SELECT
                            %s,
                            'Expansion Opportunity',
                            'Medium',
                            'CSM',
                            'Open',
                            'Customer used the AI_Assistant feature in a live product event.',
                            'CSM should review AI_Assistant adoption and evaluate whether an expansion conversation is appropriate.',
                            'Live Product Usage',
                            %s::jsonb
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM analytics.alerts a
                            WHERE a.customer_id = %s
                              AND a.alert_type = 'Expansion Opportunity'
                              AND a.status = 'Open'
                        );
                        """,
                        (
                            event.get("customer_id"),
                            json.dumps({
                                "event_id": event["event_id"],
                                "feature": event.get("feature"),
                                "user_id": event.get("user_id"),
                                "event_timestamp": event.get("timestamp"),
                            }),
                            event.get("customer_id"),
                        ),
                    )

                    if cur.rowcount > 0:
                        print(
                            f"Business action created: "
                            f"Expansion Opportunity alert for customer "
                            f"{event.get('customer_id')}"
                        )


            # -------------------------------------------------
            # 3. Commit database transaction
            # -------------------------------------------------

            db_conn.commit()

            # Commit Kafka offset only after database commit
            consumer.commit()

            print(
                f"Event processed successfully: "
                f"{event['event_id']}"
            )


        except Exception as error:

            db_conn.rollback()

            print(
                f"Error processing event: {error}"
            )


except KeyboardInterrupt:

    print("\nConsumer stopped by user.")


finally:

    consumer.close()
    db_conn.close()

    print("Consumer closed.")