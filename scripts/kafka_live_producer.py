import csv
import json
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from kafka import KafkaProducer


PROJECT_ROOT = Path(__file__).resolve().parent.parent
USERS_FILE = PROJECT_ROOT / "data" / "raw" / "users.csv"
EVENTS_FILE = PROJECT_ROOT / "data" / "raw" / "product_events.csv"

KAFKA_TOPIC = "saas-events"
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"


# Load users so we can map user_id → customer/account_id
users = {}

with open(USERS_FILE, "r", encoding="utf-8", newline="") as file:
    reader = csv.DictReader(file)

    for row in reader:
        users[row["user_id"]] = row["account_id"]


# Load product events and select one randomly
with open(EVENTS_FILE, "r", encoding="utf-8", newline="") as file:
    reader = csv.DictReader(file)
    events = list(reader)


source_event = random.choice(events)

user_id = source_event["user_id"]
feature = source_event["feature"]
customer_id = users[user_id]


# Create a new unique live event
event = {
    "event_id": f"live-{uuid.uuid4()}",
    "event_type": "product_usage",
    "customer_id": customer_id,
    "user_id": user_id,
    "feature": feature,
    "timestamp": datetime.now(timezone.utc).isoformat(),
}


producer = KafkaProducer(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_serializer=lambda value: json.dumps(value).encode("utf-8"),
)

future = producer.send(KAFKA_TOPIC, value=event)
metadata = future.get(timeout=10)

print("Live event sent successfully!")
print(f"Topic: {metadata.topic}")
print(f"Partition: {metadata.partition}")
print(f"Offset: {metadata.offset}")
print(f"Event: {event}")

producer.flush()
producer.close()