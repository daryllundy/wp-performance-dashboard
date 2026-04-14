const { ALLOWED_TIME_RANGES } = require('./config');

function parseBoolean(value, fieldName, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  const error = new Error(`Invalid ${fieldName}`);
  error.statusCode = 400;
  throw error;
}

function parseTimeRange(value, defaultValue = '1h') {
  const timeRange = value || defaultValue;
  if (!ALLOWED_TIME_RANGES.has(timeRange)) {
    const error = new Error('Invalid timeRange');
    error.statusCode = 400;
    throw error;
  }
  return timeRange;
}

function parseLimit(value, defaultValue, maxValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
    const error = new Error('Invalid limit');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function getTimeRangeInterval(timeRange) {
  switch (timeRange) {
    case '1h':
      return '1 HOUR';
    case '6h':
      return '6 HOUR';
    case '24h':
      return '24 HOUR';
    case '7d':
      return '7 DAY';
    default:
      return null;
  }
}

module.exports = {
  getTimeRangeInterval,
  parseBoolean,
  parseLimit,
  parseTimeRange
};
