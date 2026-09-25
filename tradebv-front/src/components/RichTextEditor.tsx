import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
  id,
}) => {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'link'
  ];

  return (
    <div className={cn("rich-text-editor-wrapper", className)}>
      <ReactQuill
        id={id}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="rich-text-editor"
      />
      <style>{`
        .rich-text-editor-wrapper .ql-container {
          min-height: 120px;
          font-size: 14px;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
        }
        .rich-text-editor-wrapper .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          border-bottom: 1px solid hsl(var(--input));
        }
        .rich-text-editor-wrapper .ql-container {
          border: 1px solid hsl(var(--input));
          border-top: none;
        }
        .rich-text-editor-wrapper .ql-editor {
          min-height: 120px;
        }
        .rich-text-editor-wrapper .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .rich-text-editor-wrapper .ql-snow .ql-stroke {
          stroke: hsl(var(--foreground));
        }
        .rich-text-editor-wrapper .ql-snow .ql-fill {
          fill: hsl(var(--foreground));
        }
        .rich-text-editor-wrapper .ql-snow .ql-picker-label {
          color: hsl(var(--foreground));
        }
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button:hover,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button:hover,
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button.ql-active,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button.ql-active {
          color: hsl(var(--primary));
        }
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button:hover .ql-stroke,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button:hover .ql-stroke,
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--primary));
        }
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button:hover .ql-fill,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button:hover .ql-fill,
        .rich-text-editor-wrapper .ql-snow.ql-toolbar button.ql-active .ql-fill,
        .rich-text-editor-wrapper .ql-snow .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};
