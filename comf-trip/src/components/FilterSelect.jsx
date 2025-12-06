import React from "react";
import Select, { components } from "react-select";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

export default function FilterSelect({value, onChange, options, placeholder, disabled = false, className = "", isClearable=true}) {
    // Custom DropdownIndicator component with chevron icons
    const DropdownIndicator = (props) => {
        return (
            <components.DropdownIndicator {...props}>
                {props.selectProps.menuIsOpen ? (
                    <FaChevronUp size={12} />
                ) : (
                    <FaChevronDown size={12} />
                )}
            </components.DropdownIndicator>
        );
    };

    return (
        <Select
            value={options.find(o => o.value === value) || null}
            onChange={(selected) => onChange(selected ? selected.value : "")}
            isDisabled={disabled}
            className={`filter-select ${className}`}
            classNamePrefix="react-select"
            options={options}
            placeholder={placeholder}
            isClearable={isClearable}
            isSearchable={false}
            components={{ 
                IndicatorSeparator: () => {
                    if (!value || !isClearable) return null;
                    // Si hay valor seleccionado → mostrar la línea default
                    return (
                        <span
                            style={{
                                width: "1px",
                                height: "70%",
                                backgroundColor: "#ccc",
                            }}
                        />
                    );
                },
                DropdownIndicator
            }}
        />
    );
}
