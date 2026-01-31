import React from 'react';

interface AuthStatusMessagesProps {
  error?: string;
  successMessage?: string;
}

const AuthStatusMessages: React.FC<AuthStatusMessagesProps> = ({ error, successMessage }) => {
  if (!error && !successMessage) return null;
  return (
    <>
      {error && (
        <div className="auth-error">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="auth-success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMessage}
        </div>
      )}
    </>
  );
};

export default AuthStatusMessages;
