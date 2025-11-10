/**
 * @jest-environment jsdom
 */

const path = require('path');

const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function setupDom() {
  document.body.innerHTML = `
    <form id="url-form">
      <input id="url-input" />
      <button type="submit">Submit</button>
    </form>
    <div id="loading" class="hidden"></div>
    <div id="error-message" class="hidden"></div>
    <div id="result-container" class="hidden"></div>
    <div id="content-display"></div>
    <a id="original-url"></a>
    <span id="page-title"></span>
  `;
}

function initScript() {
  require(scriptPath);
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

describe('public/script.js', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('shows validation error when the URL input is empty', async () => {
    setupDom();
    global.fetch = jest.fn();

    initScript();

    const form = document.getElementById('url-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushPromises();

    expect(global.fetch).not.toHaveBeenCalled();

    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('Please enter a valid URL');
    expect(errorMessage.classList.contains('hidden')).toBe(false);
  });

  test('displays server error messages returned from the backend', async () => {
    setupDom();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Backend failure' })
    });

    initScript();

    const urlInput = document.getElementById('url-input');
    urlInput.value = 'https://example.com';

    const form = document.getElementById('url-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushPromises();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith(
      '/fetch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const loadingElement = document.getElementById('loading');
    expect(loadingElement.classList.contains('hidden')).toBe(true);

    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('Backend failure');
    expect(errorMessage.classList.contains('hidden')).toBe(false);
  });

  test('renders fetched content and updates metadata on success', async () => {
    setupDom();

    const linkNodes = [{ target: '', rel: '' }];
    const iframeDocument = {
      open: jest.fn(),
      write: jest.fn(),
      close: jest.fn(),
      body: { scrollHeight: 432 }
    };
    iframeDocument.querySelectorAll = jest.fn(() => linkNodes);
    iframeDocument.body.querySelectorAll = iframeDocument.querySelectorAll;

    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElement(tag);
      if (tag.toLowerCase() === 'iframe') {
        Object.defineProperty(element, 'contentDocument', { value: iframeDocument });
        Object.defineProperty(element, 'contentWindow', { value: { document: iframeDocument } });
      }
      return element;
    });

    const url = 'https://example.com/resource';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          title: 'Fale Title',
          content: '<html><body><p>Hi</p><a href="/test">Link</a></body></html>'
        })
    });

    const contentDisplay = document.getElementById('content-display');
    contentDisplay.innerHTML = '<p>Old</p>';

    initScript();

    document.getElementById('url-input').value = url;
    const form = document.getElementById('url-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushPromises();
    await flushPromises();

    const iframe = contentDisplay.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframeDocument.open).toHaveBeenCalled();
    expect(iframeDocument.write).toHaveBeenCalledWith('<html><body><p>Hi</p><a href="/test">Link</a></body></html>');
    expect(iframeDocument.close).toHaveBeenCalled();

    expect(contentDisplay.innerHTML).not.toContain('Old');

    const resultContainer = document.getElementById('result-container');
    expect(resultContainer.classList.contains('hidden')).toBe(false);

    const originalUrlElement = document.getElementById('original-url');
    expect(originalUrlElement.textContent).toBe(url);
    expect(originalUrlElement.getAttribute('href')).toBe(url);

    const pageTitleElement = document.getElementById('page-title');
    expect(pageTitleElement.textContent).toBe('Fale Title');

    expect(typeof iframe.onload).toBe('function');
    iframe.onload();

    expect(iframe.style.height).toBe('432px');
    expect(linkNodes[0].target).toBe('_blank');
    expect(linkNodes[0].rel).toBe('noopener noreferrer');

    expect(global.fetch).toHaveBeenCalled();
    const [endpoint, options] = global.fetch.mock.calls[0];
    expect(endpoint).toBe('/fetch');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
});

