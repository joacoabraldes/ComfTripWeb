import React, { useState,  useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "./api";
import "../styles/editProfile.css";
import { FaUser } from "react-icons/fa";
import "../styles/header.css";
import { useTranslation } from "../i18n";
import ActionButton from "../components/ActionButton";
import PhoneField from "../components/forms/PhoneField";
import NationalityField from "../components/forms/NationalityField";
import InputField from "../components/forms/InputField";
import countries from 'world-countries';

export default function EditProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingInfo, setLoadingInfo]=useState(true);
    const { t } = useTranslation();

    const [form, setForm] = useState({
        name: "",
        email: "",
        phoneCode: "+1",
        phoneNumber: "",
        birthdate: "",
        nationality: "",
    });

    // Obtener lista de códigos de país conocidos
    const knownCountryCodes = useMemo(() => {
        const codes = new Set();
        try {
            if (Array.isArray(countries)) {
                countries.forEach((country) => {
                    if (country.idd && country.idd.root) {
                        const root = country.idd.root.replace(/^\+/, '');
                        if (country.idd.suffixes && Array.isArray(country.idd.suffixes) && country.idd.suffixes.length > 0) {
                            const firstSuffix = country.idd.suffixes[0];
                            const fullCode = `+${root}${firstSuffix}`;
                            codes.add(fullCode);
                        } else if (root) {
                            codes.add(`+${root}`);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error processing country codes:', error);
        }
        // Agregar códigos comunes como fallback
        ['+1', '+52', '+54', '+55', '+56', '+57', '+34', '+33', '+39', '+49', '+44'].forEach(code => codes.add(code));
        return Array.from(codes).sort((a, b) => b.length - a.length); // Ordenar por longitud descendente
    }, []);

    // Función para parsear el teléfono y extraer código y número
    const parsePhone = (phone) => {
        if (!phone || !phone.trim()) return { code: "+1", number: "" };
        
        const phoneTrimmed = phone.trim();
        
        // Primero intentar con el formato estándar +XX...
        const plusMatch = phoneTrimmed.match(/^(\+\d+)(.*)$/);
        if (plusMatch) {
            const potentialCode = plusMatch[1];
            const rest = plusMatch[2].trim();
            
            // Buscar el código más largo que coincida
            for (const knownCode of knownCountryCodes) {
                if (phoneTrimmed.startsWith(knownCode)) {
                    const number = phoneTrimmed.substring(knownCode.length).trim();
                    return { code: knownCode, number };
                }
            }
            
            // Si no encontramos coincidencia exacta, intentar con el código detectado
            // pero validar que tenga al menos 1 dígito y máximo 4
            const codeMatch = potentialCode.match(/^(\+\d{1,4})$/);
            if (codeMatch && rest.length > 0) {
                return { code: potentialCode, number: rest };
            }
        }
        
        // Si no tiene +, buscar códigos conocidos sin el +
        for (const knownCode of knownCountryCodes) {
            const codeWithoutPlus = knownCode.substring(1);
            if (phoneTrimmed.startsWith(codeWithoutPlus) && phoneTrimmed.length > codeWithoutPlus.length) {
                const number = phoneTrimmed.substring(codeWithoutPlus.length).trim();
                return { code: knownCode, number };
            }
        }
        
        // Si no tiene código identificable, asumir que es solo el número
        return { code: "+1", number: phoneTrimmed };
    };

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
                const { code, number } = parsePhone(u.phone || "");
                setForm({
                    name: u.name || "",
                    email: u.email || "",
                    phoneCode: code,
                    phoneNumber: number,
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

    function handleNationalityChange(nationality) {
        setForm(f => ({ ...f, nationality }));
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
            // Combinar phoneCode y phoneNumber en phone para el backend
            const phone = form.phoneNumber 
                ? `${form.phoneCode}${form.phoneNumber}`.trim()
                : "";
            
            const submitData = {
                name: form.name,
                email: form.email,
                phone: phone,
                birthdate: form.birthdate,
                nationality: form.nationality
            };

            const res = await apiPut(`/users/${stored.id}`, submitData);
            const updatedUser = res.user || { ...submitData, id: stored.id };

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
                    <InputField
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder={t('auth.register.name')}
                        required
                        disabled={loading}
                        containerClassName="edit-field"
                    />

                    <InputField
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder={t('profile.email')}
                        required
                        disabled={loading}
                        containerClassName="edit-field"
                    />

                    <div className="edit-field">
                        <PhoneField
                            code={form.phoneCode}
                            value={form.phoneNumber}
                            onCodeChange={(code) => setForm((f) => ({ ...f, phoneCode: code }))}
                            onNumberChange={(number) => setForm((f) => ({ ...f, phoneNumber: number }))}
                            placeholder={t('auth.register.phoneNumber')}
                            inputHeight={50}
                            disabled={loading}
                        />
                    </div>

                    <InputField
                        name="birthdate"
                        type="date"
                        value={form.birthdate}
                        onChange={handleChange}
                        placeholder={t('auth.register.birthdate')}
                        disabled={loading}
                        containerClassName="edit-field"
                    />

                    <NationalityField
                        value={form.nationality}
                        onChange={handleNationalityChange}
                        placeholder={t('auth.register.nationality')}
                        disabled={loading}
                        containerClassName="edit-field"
                    />

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
