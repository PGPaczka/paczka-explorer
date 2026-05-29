import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

// Language imports (lazy loaded)
const LANG_LOADERS = {
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  jsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  python: () => import('@codemirror/lang-python').then(m => m.python()),
  java: () => import('@codemirror/lang-java').then(m => m.java()),
  c: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  cpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  css: () => import('@codemirror/lang-css').then(m => m.css()),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  xml: () => import('@codemirror/lang-xml').then(m => m.xml()),
  sql: () => import('@codemirror/lang-sql').then(m => m.sql()),
  php: () => import('@codemirror/lang-php').then(m => m.php()),
  rust: () => import('@codemirror/lang-rust').then(m => m.rust()),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
}

const EXT_TO_LANG = {
  '.js': 'javascript', '.mjs': 'javascript', '.jsx': 'jsx',
  '.ts': 'typescript', '.tsx': 'jsx',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.cs': 'java', // close enough
  '.html': 'html', '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
  '.xml': 'xml', '.xsd': 'xml', '.xslt': 'xml', '.svg': 'xml',
  '.sql': 'sql',
  '.php': 'php',
  '.rs': 'rust',
  '.md': 'markdown',
  '.yml': 'json', '.yaml': 'json', // approximate
  '.sh': 'python', '.bat': 'python', // approximate
}

export default function CodePreview({ content, ext, maxHeight = '70vh' }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !content) return

    const lang = EXT_TO_LANG[(ext || '').toLowerCase()]
    const loader = lang ? LANG_LOADERS[lang] : null

    const setup = async () => {
      const extensions = [
        lineNumbers(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
      ]

      if (loader) {
        try {
          const langExt = await loader()
          extensions.push(langExt)
        } catch {}
      }

      // Destroy previous instance
      if (viewRef.current) {
        viewRef.current.destroy()
      }

      const state = EditorState.create({
        doc: content,
        extensions,
      })

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current,
      })
    }

    setup()

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [content, ext])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxHeight,
        overflow: 'auto',
        borderRadius: 8,
      }}
    />
  )
}
