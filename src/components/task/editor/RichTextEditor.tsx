
import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Heading,
} from 'lucide-react';

interface RichTextEditorProps {
  initialContent: any;
  onChange?: (content: any) => void;
  editable?: boolean;
}

export const RichTextEditor = ({ initialContent, onChange, editable = true }: RichTextEditorProps) => {
  // Create a safe default content structure
  const safeInitialContent = React.useMemo(() => {
    try {
      console.log("Processing initial content for editor:", initialContent);
      
      // Check if initialContent has a valid structure
      if (initialContent && 
          initialContent.type === 'doc' && 
          Array.isArray(initialContent.content)) {
        console.log("Initial content has valid doc structure");
        return initialContent;
      }
      
      // Fallback to a safe default structure
      console.log("Creating fallback content structure");
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: ' ' // Non-empty text to prevent errors
              }
            ]
          }
        ]
      };
    } catch (error) {
      console.error("Error processing initial content:", error);
      // Return a safe default if any errors occur
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: ' ' // Non-empty text to prevent errors
              }
            ]
          }
        ]
      };
    }
  }, [initialContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: true,
        validate: href => /^https?:\/\//.test(href),
      }),
    ],
    content: safeInitialContent,
    editable: editable,
    onUpdate: ({ editor }) => {
      try {
        if (onChange) {
          const content = editor.getJSON();
          onChange(content);
        }
      } catch (error) {
        console.error("Error in editor update:", error);
      }
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[150px]',
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          // Prevent the default behavior for specific keys if needed
          if (event.key === 'Enter' && event.ctrlKey) {
            // Custom behavior for Ctrl+Enter if needed
            return true;
          }
          return false;
        },
      },
    },
  });

  // Debugging update issues
  useEffect(() => {
    if (editor) {
      console.log("Editor initialized with content:", editor.getJSON());
    }
  }, [editor]);

  // Update editor content when initialContent changes
  useEffect(() => {
    if (editor && initialContent) {
      try {
        console.log("Updating editor with new content:", initialContent);
        // Only update if the content is different to avoid infinite loops
        const currentContent = editor.getJSON();
        const stringifiedCurrent = JSON.stringify(currentContent);
        const stringifiedNew = JSON.stringify(safeInitialContent);
        
        if (stringifiedCurrent !== stringifiedNew) {
          console.log("Content changed, updating editor");
          editor.commands.setContent(safeInitialContent);
        } else {
          console.log("Content unchanged, skipping update");
        }
      } catch (error) {
        console.error("Error updating editor content:", error);
      }
    }
  }, [editor, safeInitialContent, initialContent]);

  if (!editor) {
    return <div className="p-4 text-muted">Loading editor...</div>;
  }

  // Handle errors that might occur during rendering
  try {
    return (
      <div className="rich-text-editor">
        {editable && (
          <div className="flex flex-wrap gap-2 p-2 bg-muted/20 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? 'bg-muted' : ''}
              title="Bold"
              type="button"
            >
              <Bold className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? 'bg-muted' : ''}
              title="Italic"
              type="button"
            >
              <Italic className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
              title="Heading 1"
              type="button"
            >
              <Heading className="h-4 w-4" />
              <span className="text-xs ml-1">1</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              title="Heading 2"
              type="button"
            >
              <Heading className="h-4 w-4" />
              <span className="text-xs ml-1">2</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-muted' : ''}
              title="Bullet List"
              type="button"
            >
              <List className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'bg-muted' : ''}
              title="Numbered List"
              type="button"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = window.prompt('Enter the URL:');
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              className={editor.isActive('link') ? 'bg-muted' : ''}
              title="Link"
              type="button"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = window.prompt('Enter the image URL:');
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              }}
              title="Image"
              type="button"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo"
                type="button"
              >
                <Undo className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo"
                type="button"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <div className={`p-4 ${!editable ? 'prose prose-sm max-w-none' : ''}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering editor:", error);
    // Fallback rendering in case of errors
    return (
      <div className="p-4 border rounded-md bg-red-50 text-red-500">
        <p>Error rendering editor. Please try refreshing the page.</p>
        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }
};
