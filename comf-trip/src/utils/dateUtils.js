/**
 * Date and time formatting utilities
 */

/**
 * Format a date string to DD/MM/YYYY format
 * @param {string} dateString - ISO date string (e.g., "2024-01-15T10:30:00Z")
 * @returns {string} Formatted date string (e.g., "15/01/2024") or "-" if invalid
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = dateString.split('T')[0].split('-');
    const yy = date[0];
    const mm = date[1];
    const dd = date[2];
    return `${dd}/${mm}/${yy}`;
  } catch (e) {
    return '-';
  }
}

export function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const time=new Date(dateString).toLocaleString().split(',')[1].split(':')
        const h=time[0]
        const m=time[1]
        const info=time[2].split(' ')[1]
        const date = dateString.split('T')[0].split('-');
        const yy = date[0];
        const mm = date[1];
        const dd = date[2];
        return `${dd}/${mm}/${yy}, ${h}:${m} ${info}`;
    } catch (e) {
        return '-';
    }
}

/**
 * Format a date range
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {string} Formatted date range (e.g., "15/01/2024 — 20/01/2024")
 */
export function formatDateRange(startDate, endDate) {
  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
}

/**
 * Normalize a date string to a Date object
 * @param {string} dateString - ISO date string
 * @returns {Date} Date object or current date if invalid
 */
export function normalizeDate(dateString) {
  if (!dateString) return new Date();
  try {
    const date = dateString.split('T')[0].split('-');
    const yy = Number(date[0]);
    const mm = Number(date[1]) - 1;
    const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  } catch (e) {
    return new Date();
  }
}

/**
 * Check if a date is today
 * @param {Date} date - Date object to check
 * @returns {boolean} True if the date is today
 */
export function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a trip is currently active
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {boolean} True if trip is currently active
 */
export function isTripCurrent(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const today = new Date();
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  return today >= start && today <= end;
}

/**
 * Check if a trip is upcoming
 * @param {string} startDate - Start date ISO string
 * @returns {boolean} True if trip is upcoming
 */
export function isTripUpcoming(startDate) {
  if (!startDate) return false;
  const today = new Date();
  const start = normalizeDate(startDate);
  return today < start;
}

/**
 * Check if a trip is past
 * @param {string} endDate - End date ISO string
 * @returns {boolean} True if trip is past
 */
export function isTripPast(endDate) {
  if (!endDate) return false;
  const today = new Date();
  const end = normalizeDate(endDate);
  return today > end;
}

/**
 * Get trip status: 'upcoming' | 'current' | 'past'
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {string} Trip status
 */
export function getTripStatus(startDate, endDate) {
  if (!startDate || !endDate) return 'upcoming';
  try {
    const now = new Date();
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    
    if (start > now) return 'upcoming';
    if (start <= now && end >= now) return 'current';
    return 'past';
  } catch {
    return 'upcoming';
  }
}

