import React, {useState} from "react";
import "../styles/profile.css";
import UserIcon from "../components/icons/UserIcon";
import { useProfile } from "../pages/ProfileLogic";
import Sidebar from "./Sidebar";
import Hamburger from "./icons/Hamburger";
import {useNavigate} from "react-router-dom";

export default function Profile() {
    const { user, handleEdit, handleChangePassword, handleLogout } = useProfile();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const navigate = useNavigate();

    return (

        <div className="profile-root">
                {/* Sidebar */}
                <Sidebar open={menuAbierto} onClose={() => setMenuAbierto(false)} />

                {/* Header icons */}
                <div className="trips-header">
                    <button
                        className="icon-btn icon-left"
                        aria-label="menu"
                        onClick={() => setMenuAbierto(!menuAbierto)}
                    >
                        <Hamburger />
                    </button>

                    {/* Botón perfil: va a la página de perfil */}
                    <button
                        className="icon-btn icon-right"
                        aria-label="profile"
                        onClick={() => navigate("/profile")}
                    >
                        <UserIcon />
                    </button>
                </div>
            <div className="profile-card">
                <div className="profile-main">
                    {/* Columna izquierda: foto + nombre */}
                    <div className="profile-left">
                        <div className="profile-photo">
                            {user.foto ? <img src={user.foto} alt="Foto de perfil" /> : <UserIcon className="default-photo" />}
                        </div>
                        <h2 className="profile-name">{user.nombre}</h2>
                    </div>

                    {/* Columna derecha: información */}
                    <div className="profile-right">
                        <p><strong>Email</strong> <p>{user.email}</p></p>
                        <p><strong>Teléfono</strong> <p>{user.telefono}</p></p>
                        <p><strong>Fecha de nacimiento</strong> <p>{user.nacimiento}</p></p>
                        <p><strong>Nacionalidad</strong> <p>{user.nacionalidad}</p></p>
                    </div>
                </div>

                {/* Botones centrados abajo */}
                <div className="profile-actions">
                    <button onClick={handleEdit} className="btn-edit"><svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.9166 8.33336H8.33329C7.22822 8.33336 6.16842 8.77235 5.38701 9.55375C4.60561 10.3351 4.16663 11.395 4.16663 12.5V41.6667C4.16663 42.7718 4.60561 43.8316 5.38701 44.613C6.16842 45.3944 7.22822 45.8334 8.33329 45.8334H37.5C38.605 45.8334 39.6648 45.3944 40.4462 44.613C41.2276 43.8316 41.6666 42.7718 41.6666 41.6667V27.0834M38.5416 5.20836C39.3704 4.37956 40.4945 3.91394 41.6666 3.91394C42.8387 3.91394 43.9628 4.37956 44.7916 5.20836C45.6204 6.03716 46.086 7.16126 46.086 8.33336C46.086 9.50546 45.6204 10.6296 44.7916 11.4584L25 31.25L16.6666 33.3334L18.75 25L38.5416 5.20836Z" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg> Editar datos</button>
                    <button onClick={handleChangePassword} className="btn-change"><svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.5833 22.9167V14.5834C14.5833 11.8207 15.6808 9.17116 17.6343 7.21766C19.5878 5.26415 22.2373 4.16669 25 4.16669C27.7627 4.16669 30.4122 5.26415 32.3657 7.21766C34.3192 9.17116 35.4167 11.8207 35.4167 14.5834V22.9167M10.4167 22.9167H39.5833C41.8845 22.9167 43.75 24.7822 43.75 27.0834V41.6667C43.75 43.9679 41.8845 45.8334 39.5833 45.8334H10.4167C8.11548 45.8334 6.25 43.9679 6.25 41.6667V27.0834C6.25 24.7822 8.11548 22.9167 10.4167 22.9167Z" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg> Cambiar contraseña</button>
                    <button onClick={() => handleLogout(navigate)} className="btn-logout"><svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.75 43.75H10.4167C9.3116 43.75 8.25179 43.311 7.47039 42.5296C6.68899 41.7482 6.25 40.6884 6.25 39.5833V10.4167C6.25 9.3116 6.68899 8.25179 7.47039 7.47039C8.25179 6.68899 9.3116 6.25 10.4167 6.25H18.75M33.3333 35.4167L43.75 25M43.75 25L33.3333 14.5833M43.75 25H18.75" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg> Cerrar sesión</button>
                </div>
            </div>
        </div>
    );
}
