import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  moduleName?: string;
  compact?: boolean;
  onReset?: () => void | Promise<void>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark p-6">
          <div className="max-w-md w-full bg-surface-light dark:bg-surface-dark shadow-xl rounded-2xl p-8 border border-gray-100 dark:border-gray-800 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              Ocurrió un error inesperado en la interfaz. Por favor, intenta recargar la página.
            </p>
            {this.state.error && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left overflow-auto max-h-32">
                <code className="text-xs text-red-600 dark:text-red-400 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 px-4 rounded-xl font-medium hover:bg-primary-dark transition-colors"
            >
              <RefreshCw size={18} />
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
