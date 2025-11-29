import React from "react";
import Select from "react-select";

export default function FilterSelect({value, onChange, options, placeholder, disabled = false, className = "", isClearable=true}) {
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
            components={{ IndicatorSeparator: () => {if (!value || !isClearable) return null;
                    // Si hay valor seleccionado → mostrar la línea default
                    return (
                        <span
                            style={{
                                width: "1px",
                                height: "70%",
                                backgroundColor: "#ccc",
                            }}
                        />
                    );}}}
        />
    );
}
