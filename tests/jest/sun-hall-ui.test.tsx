/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SunHallOfFame from '@/components/SunHallOfFame'
import { TranslationProvider } from '@/lib/i18n'
import dictionary from '@/lib/i18n/locales/es.json'

const token = 'a'.repeat(64)
const entry = { id: 'score-id', alias: 'Pilota_7', points: 1, hits: 1, misses: 0, best_streak: 1, accuracy: 100 }
const mount = () => render(<TranslationProvider initialLanguage="es" dictionary={dictionary}><SunHallOfFame /></TranslationProvider>)
const response = (data: unknown, status = 200) => Promise.resolve({ ok: status === 200, status, json: async () => data })
beforeEach(() => {
  jest.useFakeTimers()
  window.PointerEvent = MouseEvent as typeof PointerEvent
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(480)
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
  global.fetch = jest.fn((url) => String(url).endsWith('/challenge') ? response({ token, seed: 1234, width: 480, height: 300 }) : String(url).endsWith('/publish') ? response({ id: entry.id, entries: [entry] }) : response({ entries: [] })) as jest.Mock
})
afterEach(() => { cleanup(); jest.useRealTimers(); jest.restoreAllMocks() })
async function play() {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Salón de la fama' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Competir (30 s)' })) })
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Atrapar la pelota' }), { button: 0, clientX: 240, clientY: 150 })
}
test('publishes only after explicit nickname and public consent, with inputs instead of a score', async () => {
  await play()
  expect(screen.getByText('Puntos: 1')).toBeInTheDocument()
  act(() => jest.advanceTimersByTime(30_100))
  expect(jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/publish'))).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Publicar resultado' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Apodo (3–20 caracteres)'), { target: { value: 'Pilota_7' } })
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Publicar resultado' }).closest('form')!) })
  expect(screen.getByText(/Resultado publicado\./)).toBeInTheDocument()
  expect(screen.getByText('Pilota_7').closest('li')).toHaveAttribute('aria-current', 'true')
  const call = jest.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/publish'))!
  const body = JSON.parse(String(call[1]?.body))
  expect(body).toEqual({ token, alias: 'Pilota_7', consent: true, inputs: [{ t: 0, x: 240, y: 150 }] })
  expect(body).not.toHaveProperty('points')
})
test('hidden tabs interrupt competition and prevent publication', async () => {
  await play()
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('alert')).toHaveTextContent('La partida se ha interrumpido')
  act(() => jest.advanceTimersByTime(60_000))
  expect(screen.queryByRole('button', { name: 'Publicar resultado' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Competir (30 s)' })).toBeInTheDocument()
})
test('unsafe aliases are rejected without a publication request', async () => {
  await play()
  act(() => jest.advanceTimersByTime(30_100))
  fireEvent.change(screen.getByLabelText('Apodo (3–20 caracteres)'), { target: { value: '<script>' } })
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Publicar resultado' }).closest('form')!) })
  expect(screen.getByRole('alert')).toHaveTextContent('Usa de 3 a 20')
  expect(jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/publish'))).toHaveLength(0)
})
test('unavailable services are visible and closing restores focus', async () => {
  jest.mocked(fetch).mockImplementation(() => response({ error: 'unavailable' }, 503) as ReturnType<typeof fetch>)
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Salón de la fama' }))
  await act(async () => {})
  expect(screen.getByRole('alert')).toHaveTextContent('El Salón no está disponible')
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
  expect(screen.getByRole('button', { name: 'Salón de la fama' })).toHaveFocus()
})

test('a challenge response cannot start a round after the tab became hidden', async () => {
  let resolveChallenge!: (value: Response) => void
  jest.mocked(fetch).mockImplementation((url) => String(url).endsWith('/challenge')
    ? new Promise((resolve) => { resolveChallenge = resolve }) as ReturnType<typeof fetch>
    : response({ entries: [] }) as ReturnType<typeof fetch>)
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Salón de la fama' }))
  fireEvent.click(screen.getByRole('button', { name: 'Competir (30 s)' }))
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  await act(async () => { resolveChallenge(await response({ token, seed: 1, width: 480, height: 300 }) as Response) })
  expect(screen.getByRole('alert')).toHaveTextContent('La partida se ha interrumpido')
  expect(screen.queryByRole('button', { name: 'Atrapar la pelota' })).not.toBeInTheDocument()
})
