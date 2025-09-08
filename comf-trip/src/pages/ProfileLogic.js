import { useState } from "react";

export function useProfile() {
    const [user, setUser] = useState({
        nombre: "Julia Pérez",
        email: "julia.perez@email.com",
        telefono: "+54 9 11 1234-5678",
        nacimiento: "1995-08-01",
        nacionalidad: "Argentina",
        foto: "" // URL de la foto si se tiene
    });

    const handleEdit = () => {
        alert("Funcionalidad de editar datos");
    };

    const handleChangePassword = () => {
        alert("Funcionalidad de cambiar contraseña");
    };

    const handleLogout = (navigate) => {
        setUser({}); // opcional: limpiar datos de usuario
        navigate("/login"); // navega a login
    };

    return {
        user,
        setUser,
        handleEdit,
        handleChangePassword,
        handleLogout
    };
}
