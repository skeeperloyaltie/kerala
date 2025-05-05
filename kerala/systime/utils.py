from datetime import datetime
import pytz

# Define IST timezone
IST_TIMEZONE = pytz.timezone('Asia/Kolkata')

def get_current_ist_time() -> datetime:
    """
    Returns the current time in IST as a timezone-aware datetime object.
    """
    return datetime.now(IST_TIMEZONE)

def to_ist(dt: datetime) -> datetime:
    """
    Converts a datetime object to IST. If the datetime is naive, assumes it's in IST.
    If the datetime is already timezone-aware, converts it to IST.
    """
    if dt is None:
        return None
    if not hasattr(dt, 'tzinfo') or dt.tzinfo is None:
        # Assume naive datetime is in IST and make it aware
        return IST_TIMEZONE.localize(dt)
    # Convert timezone-aware datetime to IST
    return dt.astimezone(IST_TIMEZONE)

def validate_ist_datetime(dt: datetime) -> bool:
    """
    Validates that a datetime is in IST. Returns True if the datetime is timezone-aware
    and in IST, False otherwise.
    """
    if dt is None or not hasattr(dt, 'tzinfo') or dt.tzinfo is None:
        return False
    return dt.tzinfo.zone == IST_TIMEZONE.zone

def make_ist_aware(dt: datetime) -> datetime:
    """
    Ensures a datetime is IST-aware. If naive, localizes to IST. If aware, converts to IST.
    """
    return to_ist(dt)