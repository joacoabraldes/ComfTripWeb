import React, { useState,  useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "./api";
import Select from "react-select";
import countryList from "react-select-country-list";
import "../styles/editProfile.css";
import { FaUser } from "react-icons/fa";
import Header from "../components/Header";
import "../styles/header.css";

export default function EditProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingInfo, setLoadingInfo]=useState(true)

    // opciones de países
    const options = useMemo(() => countryList().getData(), []);

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        birthdate: "",
        nationality: "",
    });

    // cargar datos del perfil al montar
    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
        if (!stored || !stored.id) {
            navigate("/login");
            return;
        }

        (async () => {
            try {
                const res = await apiGet(`/users/${stored.id}`);
                const u = res.user || {};
                setForm({
                    name: u.name || "",
                    email: u.email || "",
                    phone: u.phone || "",
                    birthdate: u.birthdate ? u.birthdate.split("T")[0] : "",
                    nationality: u.nationality || ""
                });
            } catch (err) {
                console.error("Error fetching profile:", err);
            }finally {
                setLoadingInfo(false);
            }
        })();
    }, [navigate]);

    function handleChange(e) {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    }

    function handleCountryChange(value) {
        setForm(f => ({ ...f, nationality: value.label }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
        if (!stored || !stored.id) {
            alert("Usuario no identificado. Inicia sesión nuevamente.");
            navigate("/login");
            return;
        }

        setLoading(true);
        try {
            const res = await apiPut(`/users/${stored.id}`, form);
            const updatedUser = res.user || { ...form, id: stored.id };

            // actualizar localStorage
            localStorage.setItem("user", JSON.stringify(updatedUser));

            alert("Datos actualizados correctamente.");
            navigate("/profile");
        } catch (err) {
            console.error("Error actualizando perfil:", err);
            alert("Error al guardar cambios");
        } finally {
            setLoading(false);
        }
    }

    if(loadingInfo){
        return <div className="profile-root" style={{fontSize:25}}>Cargando...</div>;
    }

    if (loading) {
        return <div className="profile-root" style={{fontSize:25}}>Guardando cambios del perfil…</div>;
    }

    return (
        <div className="edit-root">
            <Header/>

            <main className="edit-container">
                <button
                    className="back-btn"
                    onClick={() => navigate(-1)}
                    aria-label="volver"
                >
                    ←
                </button>

                <h1 className="edit-title">Editar Datos</h1>

                <div className="edit-photo">
                    <FaUser className="edit-photo-icon" />
                </div>

                <form className="edit-form" onSubmit={handleSubmit}>
                    <label className="field">
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Nombre"
                            required
                        />
                    </label>

                    <label className="field">
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="Mail"
                            required
                        />
                    </label>

                    <label className="field">
                        <input
                            type="text"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="Número de Teléfono"
                        />
                    </label>

                    <label className="field">
                        <input
                            type="date"
                            name="birthdate"
                            value={form.birthdate}
                            onChange={handleChange}
                            placeholder="Fecha de nacimiento"
                        />
                    </label>

                    {/* Aquí reemplazamos el input de nacionalidad */}
                    <label className="field">
                        <Select
                            className="country-select"
                            classNamePrefix="react-select"
                            options={options}
                            value={options.find(opt => opt.label === form.nationality) || null}
                            onChange={handleCountryChange}
                            placeholder="Selecciona tu nacionalidad"
                        />
                    </label>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : "Guardar Cambios"}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
