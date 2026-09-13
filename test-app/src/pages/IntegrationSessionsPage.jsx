import { useState, useEffect } from "react";

export default function IntegrationSessionsPage() {
  const [inputVal, setInputVal] = useState('');
  const [sent, setSent] = useState(false);
  const [receivedMsg, setReceivedMsg] = useState(null);
  const [defaultClicked, setDefaultClicked] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'int-sessions-msg') {
        setReceivedMsg(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <div data-testid="integration-sessions-page">
      {/* Producer section */}
      <input
        data-testid="int-sessions-producer-input"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
      />
      <button
        data-testid="int-sessions-producer-send"
        onClick={() => {
          localStorage.setItem('int-sessions-msg', inputVal);
          setSent(true);
        }}
      >
        Send
      </button>
      {sent && <p data-testid="int-sessions-producer-sent">{inputVal}</p>}

      {/* Consumer section */}
      {receivedMsg && <p data-testid="int-sessions-consumer-display">{receivedMsg}</p>}

      {/* Default-session section */}
      <button
        data-testid="int-sessions-default-btn"
        onClick={() => setDefaultClicked(true)}
      >
        Trigger
      </button>
      {defaultClicked && <p data-testid="int-sessions-default-result">default session result</p>}
    </div>
  );
}
