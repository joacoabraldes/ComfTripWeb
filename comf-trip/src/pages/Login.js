import React, { useState } from 'react';
import { apiPost } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const [form, setForm] = useState({email:'', password:''});
  const nav = useNavigate();

  const handle = e => setForm({...form, [e.target.name]: e.target.value});
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiPost('/auth/login', form);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      nav('/trips');
    } catch (err) { alert(err.message || JSON.stringify(err)); }
  };

  return (
    <div style={{maxWidth:420, margin:'30px auto', padding:20}}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={submit} style={{display:'grid', gap:10}}>
        <input name="email" placeholder="Email" onChange={handle} type="email" required />
        <input name="password" placeholder="Contraseña" type="password" onChange={handle} required />
        <button type="submit">Ingresar</button>
      </form>
    </div>
  );
}
