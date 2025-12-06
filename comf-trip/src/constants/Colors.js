/**
 * Paleta de colores centralizada de ComfTrip Web
 * 
 * Todos los colores usados en la aplicación deben estar definidos aquí.
 * Usa estos colores importando: import { Colors } from '../constants/Colors';
 * 
 * Nota: Solo se usa el tema light en web, no hay cambio de tema.
 */

// Colores primarios y de marca
const PrimaryColors = {
  primary: '#FF3951', // Color principal (rosa/rojo)
  primaryLight: '#FFE5E8', // Versión clara para fondos
  primaryLighter: '#FFF0F2', // Versión muy clara
  primaryDark: '#E6283A', // Versión oscura (para hover/pressed)
  accent: '#FFD8D8', // Acento para badges y elementos destacados
  accentCard: '#F8F1EF', // Fondo de cards con acento
};

// Colores de texto
const TextColors = {
  primary: '#252525', // Texto principal
  secondary: '#666666', // Texto secundario
  tertiary: '#757575', // Texto terciario
  muted: 'rgba(0, 0, 0, 0.5)', // Texto deshabilitado/placeholder
  mutedDark: '#999999', // Texto deshabilitado alternativo
  white: '#FFFFFF', // Texto sobre fondos oscuros
  light: '#CACACA', // Texto muy claro
  disabled: '#CCCCCC', // Texto deshabilitado
  onPrimary: '#FFFFFF', // Texto sobre color primario
};

// Colores de fondo
const BackgroundColors = {
  primary: '#FFFFFF', // Fondo principal (blanco)
  secondary: '#FCFCFC', // Fondo secundario (gris muy claro)
  tertiary: '#F8F8F8', // Fondo terciario
  input: '#F2F2F2', // Fondo de inputs
  inputMuted: 'rgba(196, 196, 196, 0.2)', // Fondo de inputs alternativo
  card: '#FFFFFF', // Fondo de cards
  cardSecondary: '#F8F9FA', // Fondo de cards secundario
  section: '#F8F9FA', // Fondo de secciones
  hover: '#F0F0F0', // Fondo hover
  selected: '#D0D0D0', // Fondo seleccionado
  overlay: 'rgba(0, 0, 0, 0.2)', // Overlay para modales
};

// Colores de borde
const BorderColors = {
  default: '#E0E0E0', // Borde por defecto
  light: '#E9ECEF', // Borde claro
  medium: '#CCCCCC', // Borde medio
  dark: '#000000', // Borde oscuro
  input: '#E0E0E0', // Borde de inputs
  divider: '#E0E0E0', // Divisor
};

// Colores de estado
const StateColors = {
  success: '#2E7D32', // Éxito
  successLight: '#E8F5E8', // Éxito claro (fondo)
  successBorder: '#D4E6D4', // Borde éxito
  error: '#FF3B30', // Error/Destructivo
  errorLight: '#FFEBEE', // Error claro (fondo)
  warning: '#FF9800', // Advertencia
  info: '#2196F3', // Información
};

// Colores de shadow
const ShadowColors = {
  black: '#000000', // Negro para sombras
  // Las opacidades se definen en los estilos (shadowOpacity)
};

// Colores adicionales específicos
const AdditionalColors = {
  green: '#2E7D32', // Verde (puede ser success)
  gray: '#757575', // Gris
  darkGray: '#495057', // Gris oscuro
  lightGray: '#6C757D', // Gris claro
  black: '#000000', // Negro
  white: '#FFFFFF', // Blanco
  transparent: 'transparent', // Transparente
};

// Exportación unificada (solo light para web)
export const Colors = {
  light: {
    // Mantener compatibilidad con el sistema existente
    text: TextColors.primary,
    background: BackgroundColors.secondary,
    tint: PrimaryColors.primary,
    icon: TextColors.secondary,
    tabIconDefault: TextColors.secondary,
    tabIconSelected: PrimaryColors.primary,
    
    // Nueva paleta unificada
    primary: PrimaryColors,
    textColors: TextColors,
    backgroundColors: BackgroundColors,
    borderColors: BorderColors,
    stateColors: StateColors,
    shadowColors: ShadowColors,
    additionalColors: AdditionalColors,
  },
};

// Exportación directa de los colores principales para fácil acceso
// Uso: Colors.primary.primary, Colors.text.primary, etc.
export {
  PrimaryColors,
  TextColors,
  BackgroundColors,
  BorderColors,
  StateColors,
  ShadowColors,
  AdditionalColors,
};

// Exportación de colores más usados como alias para facilitar el acceso
export const AppColors = {
  primary: PrimaryColors.primary,
  primaryLight: PrimaryColors.primaryLight,
  primaryLighter: PrimaryColors.primaryLighter,
  accent: PrimaryColors.accent,
  accentCard: PrimaryColors.accentCard,
  text: TextColors.primary,
  textSecondary: TextColors.secondary,
  textTertiary: TextColors.tertiary,
  textMuted: TextColors.muted,
  textMutedDark: TextColors.mutedDark,
  textDisabled: TextColors.disabled,
  background: BackgroundColors.secondary,
  backgroundPrimary: BackgroundColors.primary,
  backgroundTertiary: BackgroundColors.tertiary,
  backgroundInput: BackgroundColors.input,
  backgroundInputMuted: BackgroundColors.inputMuted,
  backgroundCard: BackgroundColors.card,
  backgroundSection: BackgroundColors.section,
  backgroundHover: BackgroundColors.hover,
  border: BorderColors.default,
  borderLight: BorderColors.light,
  error: StateColors.error,
  success: StateColors.success,
  successLight: StateColors.successLight,
  white: AdditionalColors.white,
  black: AdditionalColors.black,
  overlay: BackgroundColors.overlay,
};

export default Colors;

