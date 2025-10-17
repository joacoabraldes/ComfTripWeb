import React, { useEffect, useState } from "react";
import Select from "react-select";

export default function TimePicker({ value, onChange, occupiedSlots, minTime, maxTime, disabled }) {
    const [hour, setHour] = useState(value ? value.split(":")[0] : "");
    const [minute, setMinute] = useState(value ? value.split(":")[1] : "");

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

    // --- lógica de validación igual que antes ---
    const isInvalidStart = (h, m) => {
        const time = `${h}:${m}`;

        return occupiedSlots.some(slot => {
            if (!slot.start) return false;
            if(m===""){
                if(h===slot.start.split(":")[0] && slot.start.split(":")[1]==="00") return true;
                return h>slot.start.split(":")[0] && h<slot.end.split(":")[0];
            }
            if(h===slot.end.split(":")[0] && slot.end.split(":")[1]===m) return false;
            return time>slot.start && time < slot.end;
        });
    };

    const isInvalidEnd = (h, m) => {
        const time = `${h}:${m}`;
        if(m===""){
            if(minTime && h===minTime.split(":")[0]) return false;
        }
        if (minTime && time < minTime) return true;
        if (maxTime && time > maxTime) return true;
    };

    const isInvalid=(h,m)=>{
        if(!minTime){
            return isInvalidStart(h,m);
        }
        else {
            return isInvalidEnd(h,m)
        }
    }

    // --- sincronización con value externo ---
    useEffect(() => {
        if (!value) {
            setHour("");
            setMinute("");
        } else {
            const [h, m] = value.split(":");
            setHour(h);
            setMinute(m);
        }
    }, [value]);

    useEffect(() => {
        if (hour && minute) {
            onChange(`${hour}:${minute}`);
        } else if (hour) {
            onChange(`${hour}:`);
        }
        else {
            onChange("");
        }
    }, [hour, minute]);

    // --- opciones para react-select ---
    const hourOptions = hours.map((h) => ({
        value: h,
        label: h,
        isDisabled: isInvalid(h, "")
    }));

    const minuteOptions = minutes.map((m) => ({
        value: m,
        label: m,
        isDisabled: isInvalid(hour, m)
    }));

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px"}}>
            <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                placeholder="HH"
                isDisabled={disabled}
                isSearchable={false}
                options={hourOptions}
                value={hour ? { value: hour, label: hour } : null}
                onChange={(option) => {
                    setHour(option.value);
                    setMinute("");
                }}
            />
            <span style={{ fontSize: "24px", color: "#444" }}>:</span>
            <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                placeholder="MM"
                isDisabled={disabled || !hour}
                isSearchable={false}
                options={minuteOptions}
                value={minute ? { value: minute, label: minute } : null}
                onChange={(option) => setMinute(option.value)}
            />
        </div>
    );
}
