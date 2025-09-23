export function toast(message, duration = 3000, type = 'default') {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, duration, type } }));
}

// Convenience variants used across the app
toast.success = (message, duration = 3000) => toast(message, duration, 'success');
toast.info = (message, duration = 3000) => toast(message, duration, 'info');
toast.error = (message, duration = 3000) => toast(message, duration, 'error');
toast.warn = (message, duration = 3000) => toast(message, duration, 'warn');
