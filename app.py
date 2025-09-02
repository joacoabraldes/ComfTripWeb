from flask import Flask, render_template, request, redirect, url_for, flash, session,  jsonify
from werkzeug.security import check_password_hash,generate_password_hash
from flask_mysqldb import MySQL

app = Flask(__name__)
app.secret_key = 'clave_secreta'  # Clave secreta para mensajes flash
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = '1234'
app.config['MYSQL_DB'] = 'conftrip'
mysql = MySQL(app)

#------------------------------------------------------------------------------------------------------------
#------------------------------------------LOGIN-------------------------------------------------------------

@app.route('/login', methods = ['GET', 'POST'])
@app.route('/', methods = ['GET', 'POST'])
def login():
    if request.method == 'POST':
        usuario = request.form['username']
        contrasenia = request.form['password']
        cur = mysql.connection.cursor()
        user=cur.execute('SELECT * FROM users WHERE (username = %s)', (usuario,))
        user = cur.fetchone()
        # Busca el usuario en la base de datos
        if user==None:
            flash('No existe el usuario.')
            return redirect(url_for('login'))
        else: 
            if user and check_password_hash(user[2], contrasenia):
                session['logged_in'] = True
                flash('Inicio de sesión exitoso', 'success')
                return redirect(url_for('index'))
            else:
                flash('Credenciales incorrectas. Inténtalo nuevamente.', 'error')
                return redirect(url_for('login'))

    return render_template('login.html')

#------------------------------------------------------------------------------------------------------------
#--------------------------------------REGISTRO DE USUARIO---------------------------------------------------

@app.route('/registro')
def registro():
    return render_template('registro.html')

# Ruta para procesar el registro de un nuevo usuario
@app.route('/procesar_registro_usuario', methods=['POST'])
def procesar_registro_usuario():
    # Obtén los datos del formulario registro de usuario
    usuario = request.form['username']
    contrasenia = request.form['password']
    repetir_contrasenia = request.form['repeat_password']

    # Verifica que las contraseñas coincidan
    if contrasenia != repetir_contrasenia:
        flash('Las contraseñas no coinciden. Inténtalo nuevamente.', 'error')
        return redirect(url_for('registro'))
    
    mail=request.form['mail']
    nacionalidad=request.form['nacionalidad']
    nacimiento=request.form['nacimiento']

    cur = mysql.connection.cursor()
    user=cur.execute('SELECT * FROM users WHERE (username = %s)', (usuario,))
    m=cur.execute('SELECT * FROM users WHERE (mail = %s)', (mail,))
    user = cur.fetchone()
    m=cur.fetchone()
    if user==None or m==None:
        cur.execute("INSERT INTO users (username, password_hash, mail, nacimiento, nacionalidad) VALUES (%s, %s, %s, %s, %s)", (usuario, generate_password_hash(contrasenia), mail, nacimiento, nacionalidad))
        mysql.connection.commit()
        cur.close()
        flash('Registro exitoso. Ahora puedes iniciar sesión.', 'success')
        return redirect(url_for('login'))
    else:
        flash('Usuario ya existe.')
        return redirect(url_for('registro'))
        

#------------------------------------------------------------------------------------------------------------
#--------------------------------------CAMBIO DE CONTRASEÑA--------------------------------------------------

@app.route('/cambio_de_contraseña')
def cambio_de_contraseña():
    return render_template('cambio_de_contraseña.html')

# Ruta para procesar el cambio de contraseña
@app.route('/procesar_cambio_contrasena', methods=['POST'])
def procesar_cambio_contrasena():
    # Obtén los datos del formulario de cambio de contraseña
    usuario = request.form['username']
    contrasenia_nueva = request.form['new_password']
    repetir_contrasenia = request.form['repeat_password']

    # Verifica que las contraseñas coincidan
    if contrasenia_nueva != repetir_contrasenia:
        flash('Las contraseñas no coinciden. Inténtalo nuevamente.', 'error')
        return redirect(url_for('cambio_de_contraseña'))

    cur = mysql.connection.cursor()
    result = cur.execute('SELECT * FROM users WHERE (username = %s)', (usuario,))
    user = cur.fetchone()

    if user:
        cur.execute('UPDATE users SET password_hash = %s WHERE username = %s', (generate_password_hash(contrasenia_nueva), usuario))
        mysql.connection.commit()
        cur.close()
        flash('Contraseña cambiada exitosamente', 'success')
        return redirect(url_for('login'))
    else:
        flash('Usuario no encontrado. Inténtalo nuevamente.', 'error')
        return redirect(url_for('cambio_de_contraseña'))



#------------------------------------------------------------------------------------------------------------
#-----------------------------------RUTAS DE CADA PAGINA-----------------------------------------------------

# Ruta para la página principal
@app.route("/index", methods=["GET","POST"])
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login.html'))
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)