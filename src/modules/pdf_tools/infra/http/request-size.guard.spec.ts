import { ExecutionContext } from '@nestjs/common';
import { PdfToolsRequestSizeGuard } from './request-size.guard';
import { PdfToolsError } from '../../domain/pdf-tools.errors';

function ctx(headers: Record<string, string | undefined>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return (error as PdfToolsError).code;
  }
}

describe('PdfToolsRequestSizeGuard', () => {
  const guard = new PdfToolsRequestSizeGuard();

  it('libera Content-Length dentro do limite', () => {
    expect(guard.canActivate(ctx({ 'content-length': '1048576' }))).toBe(true);
  });

  it('acima de 80 MB (+ folga) -> TOO_LARGE', () => {
    expect(codeOf(() => guard.canActivate(ctx({ 'content-length': String(90 * 1024 * 1024) })))).toBe('TOO_LARGE');
  });

  it('sem Content-Length (chunked) ou invalido -> LENGTH_REQUIRED', () => {
    expect(codeOf(() => guard.canActivate(ctx({ 'transfer-encoding': 'chunked' })))).toBe('LENGTH_REQUIRED');
    expect(codeOf(() => guard.canActivate(ctx({ 'content-length': 'abc' })))).toBe('LENGTH_REQUIRED');
    expect(codeOf(() => guard.canActivate(ctx({ 'content-length': '-5' })))).toBe('LENGTH_REQUIRED');
    expect(codeOf(() => guard.canActivate(ctx({ 'content-length': '' })))).toBe('LENGTH_REQUIRED');
  });
});
