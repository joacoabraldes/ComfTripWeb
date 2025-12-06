// src/components/forms/NationalityField.jsx
import React, { useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import { useTranslation } from "../../i18n";
import "../../styles/nationality-field.css";

export default function NationalityField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  containerClassName = "",
  error,
}) {
  const { t } = useTranslation();
  const options = useMemo(() => countryList().getData(), []);

  const handleChange = (selectedOption) => {
    onChange?.(selectedOption ? selectedOption.label : "");
  };

  const selectedValue = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.label === value) || null;
  }, [options, value]);

  const defaultPlaceholder = placeholder || t("auth.register.selectNationality");

  return (
    <div className={`nationality-field-container ${containerClassName}`}>
      {label && (
        <label className="nationality-field-label" htmlFor="nationality-select">
          {label}
        </label>
      )}
      <Select
        id="nationality-select"
        className={`nationality-select ${className}`}
        classNamePrefix="react-select"
        options={options}
        value={selectedValue}
        onChange={handleChange}
        placeholder={defaultPlaceholder}
        isDisabled={disabled}
        isSearchable
        isClearable={false}
      />
      {error && <div className="nationality-field-error">{error}</div>}
    </div>
  );
}

