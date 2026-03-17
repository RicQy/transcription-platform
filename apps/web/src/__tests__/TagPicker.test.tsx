import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TagPicker from '../components/editor/TagPicker'
import type { Editor } from '@tiptap/react'

function createMockEditor() {
  const insertTag = vi.fn().mockReturnValue(true)
  return {
    chain: () => ({
      focus: () => ({
        insertTag: (tag: string) => ({
          run: () => insertTag(tag),
        }),
      }),
    }),
    _insertTag: insertTag,
  } as unknown as Editor & { _insertTag: ReturnType<typeof vi.fn> }
}

describe('TagPicker', () => {
  it('renders the Insert Tag button', () => {
    render(<TagPicker editor={null} />)
    expect(screen.getByRole('button', { name: /insert tag/i })).toBeInTheDocument()
  })

  it('opens the tag list on click', async () => {
    const user = userEvent.setup()
    render(<TagPicker editor={null} />)
    await user.click(screen.getByRole('button', { name: /insert tag/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('[inaudible]')).toBeInTheDocument()
  })

  it('inserts the selected tag into the editor', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<TagPicker editor={editor} />)

    await user.click(screen.getByRole('button', { name: /insert tag/i }))
    await user.click(screen.getByText('[inaudible]'))

    await waitFor(() => {
      expect(editor._insertTag).toHaveBeenCalledWith('[inaudible]')
    })
  })

  it('closes the dropdown after inserting a tag', async () => {
    const user = userEvent.setup()
    const editor = createMockEditor()
    render(<TagPicker editor={editor} />)

    await user.click(screen.getByRole('button', { name: /insert tag/i }))
    await user.click(screen.getByText('[crosstalk]'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
