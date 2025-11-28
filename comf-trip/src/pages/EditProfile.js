import React, { useState,  useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "./api";
import Select from "react-select";
import countryList from "react-select-country-list";
import "../styles/editProfile.css";
import { FaUser } from "react-icons/fa";
import "../styles/header.css";
import { useTranslation } from "../i18n";
import ActionButton from "../components/ActionButton";

export default function EditProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingInfo, setLoadingInfo]=useState(true);
    const { t } = useTranslation();

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
            alert(t('editProfile.userNotIdentified'));
            navigate("/login");
            return;
        }

        setLoading(true);
        try {
            const res = await apiPut(`/users/${stored.id}`, form);
            const updatedUser = res.user || { ...form, id: stored.id };

            // actualizar localStorage
            localStorage.setItem("user", JSON.stringify(updatedUser));

            alert(t('editProfile.success'));
            navigate("/profile");
        } catch (err) {
            console.error("Error actualizando perfil:", err);
            alert(t('editProfile.error'));
        } finally {
            setLoading(false);
        }
    }

    if(loadingInfo){
        return <div className="profile-root" style={{fontSize:25}}>{t('editProfile.loading')}</div>;
    }

    return (
        <div className="edit-root">

            <main className="edit-container">

                <h1 className="edit-title">{t('editProfile.title')}</h1>

                <div className="edit-photo">
                    <FaUser className="edit-photo-icon" />
                </div>

                <form className="edit-form" onSubmit={handleSubmit}>
                    <label className="edit-field">
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder={t('auth.register.name')}
                            required
                            disabled={loading}
                            className={"input"}
                        />
                    </label>

                    <label className="edit-field">
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder={t('profile.email')}
                            required
                            disabled={loading}
                            className={"input"}
                        />
                    </label>

                    <label className="edit-field">
                        <input
                            type="text"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder={t('profile.phone')}
                            disabled={loading}
                            className={"input"}
                        />
                    </label>

                    <label className="edit-field">
                        <input
                            type="date"
                            name="birthdate"
                            value={form.birthdate}
                            onChange={handleChange}
                            placeholder={t('auth.register.birthdate')}
                            disabled={loading}
                            className={"input"}
                        />
                    </label>

                    {/* Aquí reemplazamos el input de nacionalidad */}
                    <label className="edit-field">
                        <Select
                            className="dropdown-select"
                            classNamePrefix="react-select"
                            options={options}
                            value={options.find(opt => opt.label === form.nationality) || null}
                            onChange={handleCountryChange}
                            placeholder={t('auth.register.nationality')}
                            isDisabled={loading}
                        />
                    </label>

                    <div className="form-actions">
                        <ActionButton type="submit" variant="edit" disabled={loading}>
                            {loading ? t('editProfile.saving') : t('editProfile.save')}
                        </ActionButton>
                    </div>
                </form>
            </main>
        </div>
    );
}
