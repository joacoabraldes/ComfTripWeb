import React from "react";

/**
 * FilterSelect Component - Reusable select dropdown for filters
 * @param {string} value - Current selected value
 * @param {function} onChange - Change handler
 * @param {array} options - Array of {value, label} objects
 * @param {string} placeholder - Placeholder text (optional)
 * @param {boolean} disabled - Whether select is disabled
 * @param {string} className - Additional CSS classes
 */
export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = "",
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`filter-select ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

