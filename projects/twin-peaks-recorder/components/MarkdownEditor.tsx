import { useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';

interface MarkdownEditorProps {
  content: string;
  fontFamily: string;
  textColor?: string;
  onChange?: (content: string) => void;
  highlightedWords?: string[];
}

export interface MarkdownEditorRef {
  editor: Editor | null;
}

// 高亮指定词（添加下划线）
const applyHighlights = (text: string, highlightedWords?: string[]): string => {
  if (!highlightedWords || highlightedWords.length === 0) {
    return text;
  }
  const pattern = highlightedWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return text.replace(regex, '<u>$1</u>');
};

// 将纯文本转换为HTML（双换行符变段落）
const textToHtml = (text: string, highlightedWords?: string[]): string => {
  if (!text) return '<p></p>';
  return text
    .split('\n\n')
    .map(p => {
      const highlighted = applyHighlights(p, highlightedWords);
      return `<p>${highlighted.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
};

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(({
  content,
  fontFamily,
  textColor = 'rgba(255,255,255,0.95)',
  onChange,
  highlightedWords,
}, ref) => {
  // 将纯文本转换为HTML（包含高亮词的下划线）
  const htmlContent = useMemo(() => textToHtml(content, highlightedWords), [content, highlightedWords]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: 'editor-glow',
        },
      }),
    ],
    content: htmlContent,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px]',
        style: `font-family: ${fontFamily}; color: ${textColor};`,
      },
      handleKeyDown: (view, event) => {
        // Cmd+D (Mac) or Ctrl+D (Windows) to toggle glow on selection
        if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
          event.preventDefault();
          const { state } = view;
          const { from, to, empty } = state.selection;
          if (!empty) {
            // Toggle highlight mark on selection
            const hasHighlight = state.doc.rangeHasMark(from, to, state.schema.marks.highlight);
            if (hasHighlight) {
              view.dispatch(state.tr.removeMark(from, to, state.schema.marks.highlight));
            } else {
              view.dispatch(state.tr.addMark(from, to, state.schema.marks.highlight.create()));
            }
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  // 暴露editor给父组件
  useImperativeHandle(ref, () => ({
    editor,
  }), [editor]);

  // 当content prop变化时，更新editor内容
  useEffect(() => {
    if (editor && htmlContent) {
      const currentContent = editor.getHTML();
      if (currentContent !== htmlContent) {
        editor.commands.setContent(htmlContent);
      }
    }
  }, [editor, htmlContent]);

  return (
    <>
      <style>{`
        .ProseMirror {
          outline: none;
          min-height: 200px;
        }
        .ProseMirror p {
          margin-bottom: 1rem;
        }
        .ProseMirror h1 {
          font-size: 1.75rem;
          font-weight: bold;
          margin-bottom: 0.75rem;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        .ProseMirror strong {
          font-weight: bold;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror blockquote {
          border-left: 3px solid rgba(255,255,255,0.3);
          padding-left: 1rem;
          margin-left: 0;
          font-style: italic;
          opacity: 0.8;
        }
        .ProseMirror code {
          background: rgba(255,255,255,0.1);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-family: monospace;
        }
        .ProseMirror pre {
          background: rgba(0,0,0,0.3);
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.2);
          margin: 1.5rem 0;
        }
        /* Selection style - 发光效果 */
        .ProseMirror ::selection {
          background-color: transparent;
          color: #fff;
          text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5);
        }
        /* Highlighted words - 捕获的词下划线 */
        .ProseMirror u {
          text-decoration: underline;
          text-decoration-color: rgba(255,255,255,0.5);
          text-underline-offset: 3px;
        }
        /* Cmd+D marked text - 白色发光效果 */
        .ProseMirror .editor-glow,
        .ProseMirror mark {
          background: transparent;
          color: #fff;
          text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5);
        }
      `}</style>
      <EditorContent editor={editor} />
    </>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
