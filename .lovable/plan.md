## Problem

In the Edit Project modal's Description tab, formatting (headings, bullets, numbered lists, bold/italic, etc.) doesn't visually appear while typing. It only shows after saving and re-viewing the description.

## Root cause

`src/components/task/editor/RichTextEditor.tsx` only applies the Tailwind `prose` typography classes when the editor is **read-only** (`!editable`):

```tsx
<div className={`p-4 ${!editable ? 'prose prose-sm ...' : ''}`}>
  <EditorContent editor={editor} />
</div>
```

Tailwind's preflight strips default browser styles from `h1`, `h2`, `ul`, `ol`, etc. So while editing, TipTap inserts the right semantic tags, but they render unstyled — making formatting invisible until the modal is reopened in read-only mode where `prose` kicks in.

## Fix

Apply the same `prose` typography classes in editable mode so formatting is visible live as the user types.

In `src/components/task/editor/RichTextEditor.tsx`, change the wrapper so the prose classes apply in both states (keeping `p-4` either way):

```tsx
<div className="p-4 prose prose-sm max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-4 prose-h2:text-xl prose-h2:mb-3 prose-h3:text-lg prose-h3:mb-2 prose-p:mb-2 prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-2 prose-li:mb-1">
  <EditorContent editor={editor} />
</div>
```

This is a one-line change in a single shared editor component. It also benefits any other place that uses `RichTextEditor` in editable mode (e.g. task description editing) where the same issue would exist.

## Scope

- File changed: `src/components/task/editor/RichTextEditor.tsx` (1 JSX line).
- No state, data, or business-logic changes.
- No impact on saved data — only presentation while editing.
