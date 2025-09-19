import React, { useEffect, useState } from "react";

export default function TimePicker({ value, onChange, occupiedSlots = [], minTime, maxTime, disabled }) {
    const [hour, setHour] = useState(value ? value.split(":")[0] : "");
    const [minute, setMinute] = useState(value ? value.split(":")[1] : "");

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

    const isInvalidStart=(h, m) => {
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
        }else if(hour){
            onChange(`${hour}:`);
        }
        else {
            onChange("");
        }
    }, [hour, minute]);

    return (
        <div style={{ display: "flex", gap: "6px" }}>
            <select value={hour} disabled={disabled} onChange={e => setHour(e.target.value)}>
                <option value="">HH</option>
                {hours.map(h => (
                    <option key={h} value={h} disabled={isInvalid(h, "")}>{h}</option>
                ))}
            </select>
            <span style={{ fontSize: "30px", padding: "5px" }}>:</span>
            <select value={minute} disabled={disabled} onChange={e => setMinute(e.target.value)}>
                <option value="">MM</option>
                {minutes.map(m => (
                    <option key={m} value={m} disabled={hour && isInvalid(hour, m)}>
                        {m}
                    </option>
                ))}
            </select>
        </div>
    );
}
