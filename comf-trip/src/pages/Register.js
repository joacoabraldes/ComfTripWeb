import React, { useState } from 'react';
import api from './api';

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', nationality: '', birthdate: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await api.post('/register', form);
      setMessage(res.data.message || 'Usuario registrado correctamente');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error al registrar');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
      <input name="password" type="password" placeholder="Contraseña" value={form.password} onChange={handleChange} required />
      <input name="nationality" placeholder="Nacionalidad" value={form.nationality} onChange={handleChange} />
      <input name="birthdate" type="date" placeholder="Fecha de nacimiento" value={form.birthdate} onChange={handleChange} />
      <button type="submit">Registrarse</button>
      <div>{message}</div>
    </form>
  );
}