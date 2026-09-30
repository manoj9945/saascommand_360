import json

from datetime import datetime, timezone

from kafka import KafkaProducer


producer = KafkaProducer(

    bootstrap_servers="localhost:9092",

    value_serializer=lambda value: json.dumps(value).encode("utf-8"),

)

event = {
    "event_id": "test-ai-assistant-001",
    "event_type": "product_usage",
    "customer_id": "103559",
    "user_id": "209924",
    "feature": "AI_Assistant",
    "timestamp": datetime.now(timezone.utc).isoformat(),
}

future = producer.send("saas-events", value=event)

metadata = future.get(timeout=10)

print("Event sent successfully!")

print(f"Topic: {metadata.topic}")

print(f"Partition: {metadata.partition}")

print(f"Offset: {metadata.offset}")

print(f"Event: {event}")

producer.flush()

producer.close()