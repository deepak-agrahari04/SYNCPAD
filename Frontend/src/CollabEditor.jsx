import React, { useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import randomColor from 'randomcolor';
import debounce from 'lodash.debounce';

function escapeCssContent(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/"/g, '\\"');
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || '').trim();
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return `rgba(250, 129, 0, ${alpha})`;
  let raw = match[1];
  if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
  const int = parseInt(raw, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveYjsServerUrl(backendUrl) {
  // Example: http://localhost:5000 -> ws://localhost:5000/yjs
  try {
    const base = new URL(backendUrl || 'http://localhost:5000');
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = '/yjs';
    base.search = '';
    base.hash = '';
    return base.toString().replace(/\/$/, '');
  } catch {
    return 'ws://localhost:5000/yjs';
  }
}

const CollabEditor = forwardRef(
  (
    {
      roomId = 'default-room',
      currentUser = { id: 'user1', name: 'Anonymous', color: null },
      language = 'javascript',
      theme = 'dark',
      editorOptions = {},
      onStatus,
    },
    ref
  ) => {
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const bindingRef = useRef(null);
  const styleElRef = useRef(null);

  const yjsServerUrl = useMemo(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    return deriveYjsServerUrl(backendUrl);
  }, []);

  const localDraftKey = useMemo(() => `syncpad:draft:${roomId}`, [roomId]);

  // Expose getting the current code to parent
  useImperativeHandle(ref, () => ({
    getCode: () => (editorRef.current ? editorRef.current.getValue() : ''),
    setCode: (nextCode) => {
      if (editorRef.current) editorRef.current.setValue(nextCode ?? '');
    },
    focus: () => {
      editorRef.current?.focus?.();
    },
  }));

  const persistDraft = useCallback(
    debounce((code) => {
      try {
        localStorage.setItem(localDraftKey, code);
      } catch {
        // ignore storage errors
      }
    }, 700),
    [localDraftKey]
  );

  const ensureRemoteCursorStyleEl = () => {
    if (styleElRef.current) return styleElRef.current;
    const existing = document.getElementById('syncpad-yjs-cursors');
    if (existing) {
      styleElRef.current = existing;
      return existing;
    }
    const style = document.createElement('style');
    style.id = 'syncpad-yjs-cursors';
    document.head.appendChild(style);
    styleElRef.current = style;
    return style;
  };

  const updateRemoteCursorStyles = useCallback(() => {
    const provider = providerRef.current;
    const doc = docRef.current;
    if (!provider || !doc) return;

    const style = ensureRemoteCursorStyleEl();
    const states = provider.awareness.getStates();
    let css = `
      .yRemoteSelection { border-radius: 2px; }
      .yRemoteSelectionHead { position: absolute; height: 100%; box-sizing: border-box; }
      .yRemoteSelectionHead::after { position: absolute; top: -1.55em; left: -2px; padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 600; line-height: 1.1; white-space: nowrap; pointer-events: none; }
    `;

    states.forEach((state, clientId) => {
      if (clientId === doc.clientID) return;
      const user = state?.user || {};
      const name = escapeCssContent(user.name || 'Anonymous');
      const color = typeof user.color === 'string' && user.color.trim() ? user.color.trim() : '#fa8100';
      const selectionBg = hexToRgba(color, 0.22);

      css += `
        .yRemoteSelection-${clientId} { background-color: ${selectionBg}; }
        .yRemoteSelectionHead-${clientId} { border-left: ${color} solid 2px; border-top: ${color} solid 2px; border-bottom: ${color} solid 2px; }
        .yRemoteSelectionHead-${clientId}::after { content: "${name}"; background-color: ${color}; color: #ffffff; }
      `;
    });

    style.textContent = css;
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Fresh Y.Doc per mount/room
    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    // Initialize Yjs + WebSocket Provider (server-hosted)
    const provider = new WebsocketProvider(yjsServerUrl, roomId, ydoc, { connect: true });
    providerRef.current = provider;

    provider.on('status', (event) => {
      onStatus?.(event.status);
    });

    const type = ydoc.getText('monaco');
    bindingRef.current = new MonacoBinding(
      type,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );

    // Setup Presence (Live Cursors)
    const color =
      typeof currentUser.color === 'string' && currentUser.color.trim()
        ? currentUser.color.trim()
        : randomColor({ luminosity: theme === 'dark' ? 'dark' : 'light' });
    provider.awareness.setLocalStateField('user', {
      name: currentUser.name || 'Anonymous',
      color: color,
    });

    updateRemoteCursorStyles();
    provider.awareness.on('change', updateRemoteCursorStyles);

    // Restore local draft only if the shared doc is empty after initial sync.
    provider.on('sync', (isSynced) => {
      if (!isSynced) return;
      const current = type.toString();
      if (current && current.length > 0) return;
      let draft = '';
      try {
        draft = localStorage.getItem(localDraftKey) || '';
      } catch {
        draft = '';
      }
      const initial = draft || "console.log('Welcome to your SyncPad room!');";
      if (initial) {
        ydoc.transact(() => {
          type.insert(0, initial);
        });
      }
    });

    // Autosave to local draft storage (debounced)
    const onDocUpdate = () => {
      persistDraft(type.toString());
    };
    ydoc.on('update', onDocUpdate);

    // Cleanup helpers kept on refs
    providerRef.current.__syncpad_cleanup__ = () => {
      try {
        provider.awareness.off('change', updateRemoteCursorStyles);
      } catch {
        // ignore
      }
      try {
        ydoc.off('update', onDocUpdate);
      } catch {
        // ignore
      }
    };
  };

  const handleEditorChange = (value) => {
    // no-op: yjs binding + doc update handler handle persistence
  };

  useEffect(() => {
    // Update awareness user info if it changes after mount.
    const provider = providerRef.current;
    if (!provider) return;
    const nextColor =
      typeof currentUser.color === 'string' && currentUser.color.trim()
        ? currentUser.color.trim()
        : randomColor({ luminosity: theme === 'dark' ? 'dark' : 'light' });
    provider.awareness.setLocalStateField('user', {
      name: currentUser.name || 'Anonymous',
      color: nextColor,
    });
    updateRemoteCursorStyles();
  }, [currentUser.name, currentUser.color, theme, updateRemoteCursorStyles]);

  useEffect(() => {
    return () => {
      // Cleanup
      try {
        providerRef.current?.__syncpad_cleanup__?.();
      } catch {
        // ignore
      }
      providerRef.current?.destroy?.();
      bindingRef.current?.destroy?.();
      docRef.current?.destroy?.();
    };
  }, [roomId]);

  return (
    <div className="w-full h-full flex overflow-hidden">
      <Editor
        height="100%"
        theme={theme === 'light' ? 'light' : 'vs-dark'}
        language={language === 'python' ? 'python' : language === 'cpp' ? 'cpp' : 'javascript'}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          wordWrap: 'on',
          minimap: { enabled: false },
          fontSize: 14,
          formatOnPaste: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          padding: { top: 16 },
          ...editorOptions,
        }}
      />
    </div>
  );
});

export default CollabEditor;