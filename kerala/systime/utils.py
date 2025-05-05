import logging
from datetime import datetime
import pytz
import tzlocal  # For detecting local system timezone

logger = logging.getLogger(__name__)

# Define IST timezone
IST_TIMEZONE = pytz.timezone('Asia/Kolkata')

def get_current_ist_time() -> datetime:
    """
    Returns the current time in IST as a timezone-aware datetime object.
    Uses the IST timezone directly, independent of the local system timezone.
    """
    ist_time = datetime.now(IST_TIMEZONE)
    logger.debug(f"Current IST time: {ist_time}")
    return ist_time

def get_local_to_ist_time() -> datetime:
    """
    Returns the current local system time converted to IST as a timezone-aware datetime object.
    Detects the local system timezone and converts the local time to IST.
    """
    try:
        local_tz = tzlocal.get_localzone()  # Get the local system timezone
        local_time = datetime.now(local_tz)  # Get current time in local timezone
        ist_time = local_time.astimezone(IST_TIMEZONE)  # Convert to IST
        logger.debug(f"Local time ({local_tz}): {local_time} converted to IST: {ist_time}")
        return ist_time
    except Exception as e:
        logger.error(f"Error converting local time to IST: {str(e)}")
        # Fallback to get_current_ist_time if local timezone detection fails
        return get_current_ist_time()

def to_ist(dt: datetime) -> datetime:
    """
    Converts a datetime object to IST. If the datetime is naive, assumes it's in IST.
    If the datetime is already timezone-aware, converts it to IST.
    """
    if dt is None:
        return None
    if not hasattr(dt, 'tzinfo') or dt.tzinfo is None:
        # Assume naive datetime is in IST and make it aware
        ist_dt = IST_TIMEZONE.localize(dt)
        logger.debug(f"Naive datetime {dt} localized to IST: {ist_dt}")
        return ist_dt
    # Convert timezone-aware datetime to IST
    ist_dt = dt.astimezone(IST_TIMEZONE)
    logger.debug(f"Aware datetime {dt} converted to IST: {ist_dt}")
    return ist_dt

def validate_ist_datetime(dt: datetime) -> bool:
    """
    Validates that a datetime is in IST. Returns True if the datetime is timezone-aware
    and in IST, False otherwise.
    """
    if dt is None or not hasattr(dt, 'tzinfo') or dt.tzinfo is None:
        logger.warning(f"Invalid IST datetime: {dt} (None or naive)")
        return False
    is_ist = dt.tzinfo.zone == IST_TIMEZONE.zone
    if not is_ist:
        logger.warning(f"Non-IST datetime detected: {dt} (timezone: {dt.tzinfo.zone})")
    return is_ist

def make_ist_aware(dt: datetime) -> datetime:
    """
    Ensures a datetime is IST-aware. If naive, localizes to IST. If aware, converts to IST.
    """
    ist_dt = to_ist(dt)
    if not validate_ist_datetime(ist_dt):
        logger.error(f"Failed to make datetime IST-aware: {dt}")
    return ist_dt