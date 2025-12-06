// src/components/forms/InputField.jsx
import React, { useState, forwardRef } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useTranslation } from "../../i18n";
import "../../styles/input-field.css";

const InputField = forwardRef((props, ref) => {
  const {
    label,
    showPasswordToggle = false,
    showPassword: controlledShowPassword,
    onTogglePassword: controlledOnTogglePassword,
    className = "",
    containerClassName = "",
    error,
    ...inputProps
  } = props;

  const { t } = useTranslation();
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Usar estado controlado si se proporciona, sino usar estado interno
  const showPassword = controlledShowPassword !== undefined 
    ? controlledShowPassword 
    : internalShowPassword;

  const handleTogglePassword = () => {
    if (controlledOnTogglePassword) {
      controlledOnTogglePassword();
    } else {
      setInternalShowPassword(!internalShowPassword);
    }
  };

  // Determinar el tipo de input
  const inputType = showPasswordToggle
    ? showPassword
      ? "text"
      : "password"
    : inputProps.type || "text";

  // Si se proporciona containerClassName, usar ese estilo en lugar del default
  const isCustomContainer = containerClassName && containerClassName !== "";
  const containerClass = isCustomContainer 
    ? containerClassName 
    : `input-field-container ${containerClassName}`;
  
  const labelClass = isCustomContainer 
    ? `${containerClassName}-label` 
    : "input-field-label";

  // Separar type de inputProps para evitar conflictos
  const { type: _ignoredType, ...restInputProps } = inputProps;

  return (
    <div className={containerClass}>
      {label && (
        <label className={labelClass} htmlFor={inputProps.id || inputProps.name}>
          {label}
        </label>
      )}
      <div className={`input-field-wrapper ${showPasswordToggle ? "input-field-wrapper--password" : ""}`}>
        <input
          ref={ref}
          {...restInputProps}
          type={inputType}
          className={`input-field ${className}`}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={handleTogglePassword}
            className="input-field-toggle-btn"
            aria-label={
              showPassword
                ? t("auth.register.hidePassword")
                : t("auth.register.showPassword")
            }
            tabIndex={-1}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        )}
      </div>
      {error && <div className="input-field-error">{error}</div>}
    </div>
  );
});

InputField.displayName = "InputField";

export default InputField;

