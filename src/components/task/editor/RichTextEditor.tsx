
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Image as ImageIcon,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon
} from 'lucide-react';
import { uploadImage } from '@/lib/supabase-storage';
import { toast } from "sonner";

interface RichTextEditorProps {
  content: any;
  onChange: (content: any) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'space-y-1 list-disc list-outside ml-4',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'space-y-1 list-decimal list-outside ml-4',
          },
        },
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: 'font-bold',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-gray-300 pl-4 italic my-4',
          },
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
          loading: 'lazy',
        },
        allowBase64: true,
      }),
      Link.configure({
        HTMLAttributes: {
          class: 'text-blue-500 hover:text-blue-700 underline',
        },
        openOnClick: false,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[200px] max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  if (!editor) {
    return null;
  }

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async () => {
      if (input.files?.length) {
        const file = input.files[0];
        
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image too large. Maximum size is 5MB');
          return;
        }
        
        const loadingToast = toast.loading('Uploading image...');
        
        try {
          const url = await uploadImage(file);
          
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
            toast.dismiss(loadingToast);
            toast.success('Image uploaded successfully');
          } else {
            toast.dismiss(loadingToast);
            toast.error('Failed to upload image');
          }
        } catch (error) {
          console.error('Error in image upload handler:', error);
          toast.dismiss(loadingToast);
          toast.error('Failed to upload image');
        }
      }
    };
    
    input.click();
  };

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  // Helper function to update the editor content when it changes externally
  // This ensures that when the task is reopened, the content loads properly
  if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
    editor.commands.setContent(content);
  }

  return (
    <div className="border rounded-md">
      <div className="border-b p-2 flex flex-wrap gap-1 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'bg-muted' : ''}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImageUpload}
          title="Upload Image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={addLink}
          className={editor.isActive('link') ? 'bg-muted' : ''}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
      <style>
        {`
          .ProseMirror h1 {
            font-size: 2.5em;
            margin-top: 0.67em;
            margin-bottom: 0.67em;
          }
          .ProseMirror h2 {
            font-size: 2em;
            margin-top: 0.83em;
            margin-bottom: 0.83em;
          }
          .ProseMirror h3 {
            font-size: 1.5em;
            margin-top: 1em;
            margin-bottom: 1em;
          }
          .ProseMirror p {
            margin: 1em 0;
          }
          .ProseMirror ul,
          .ProseMirror ol {
            margin: 1em 0;
            padding-left: 1em;
          }
          .ProseMirror li {
            margin: 0.5em 0;
          }
          .ProseMirror li p {
            margin: 0;
            display: inline;
          }
          .ProseMirror img {
            max-width: 100%;
            height: auto;
            display: block;
          }
        `}
      </style>
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
