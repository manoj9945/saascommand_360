import getpass
import json

import psycopg
from kafka import KafkaConsumer


KAFKA_TOPIC = "saas-events"
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"


password = getpass.getpass("Enter PostgreSQL password: ")

db_conn = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="saascommand_360",
    user="postgres",
    password=password,
)

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
                    ON CONFLICT (event_id) DO NOTHING;
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

            db_conn.commit()
            consumer.commit()

            print(f"Event processed successfully: {event['event_id']}")

        except Exception as error:
            db_conn.rollback()
            print(f"Error processing event: {error}")


except KeyboardInterrupt:
    print("\nConsumer stopped by user.")

finally:
    consumer.close()
    db_conn.close()
    print("Consumer closed.")