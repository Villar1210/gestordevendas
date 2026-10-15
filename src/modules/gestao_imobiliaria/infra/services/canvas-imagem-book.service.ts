// src/modules/gestao_imobiliaria/infra/services/canvas-imagem-book.service.ts
// Camada de INFRA: redimensiona/re-codifica as imagens JPG do book com
// @napi-rs/canvas (ja usado pelo leitor de PDF, sem dependencia nova).
// - Orientacao EXIF: o decodificador do @napi-rs/canvas (Skia) ja aplica a
//   tag Orientation ao carregar o JPEG (foto de celular "deitada" volta a
//   ficar em pe), entao a largura/altura usadas aqui ja sao as corretas.
// - Re-codificar a partir do canvas descarta TODO o EXIF (localizacao GPS,
//   modelo do celular, data) - nada disso chega ao site.
import { BadRequestException, Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { IImagemBookService, ImagemJpegBook } from '../../domain/services/imagem-book.interface';
import { naFila } from './fila-render';

@Injectable()
export class CanvasImagemBookService implements IImagemBookService {
  redimensionarJpegs(
    jpegs: Buffer[],
    opcoes: { larguraMaxPx: number; qualidadeJpeg: number },
  ): Promise<ImagemJpegBook[]> {
    // Mesma fila do render de PDF: um processamento pesado por vez.
    return naFila(() => this.processar(jpegs, opcoes));
  }

  private async processar(
    jpegs: Buffer[],
    opcoes: { larguraMaxPx: number; qualidadeJpeg: number },
  ): Promise<ImagemJpegBook[]> {
    const saida: ImagemJpegBook[] = [];
    // Uma imagem por vez: o pico de memoria fica limitado a uma imagem.
    for (let i = 0; i < jpegs.length; i++) {
      let imagem: Awaited<ReturnType<typeof loadImage>>;
      try {
        imagem = await loadImage(jpegs[i]);
      } catch {
        throw new BadRequestException(`Não foi possível ler a imagem nº ${i + 1}. Envie um JPG válido.`);
      }
      if (!(imagem.width > 0 && imagem.height > 0)) {
        throw new BadRequestException(`Não foi possível ler a imagem nº ${i + 1}. Envie um JPG válido.`);
      }
      const escala = Math.min(1, opcoes.larguraMaxPx / imagem.width); // nunca amplia
      const largura = Math.max(1, Math.round(imagem.width * escala));
      const altura = Math.max(1, Math.round(imagem.height * escala));
      const canvas = createCanvas(largura, altura);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(imagem, 0, 0, largura, altura);
      saida.push({ jpeg: await canvas.encode('jpeg', opcoes.qualidadeJpeg), largura, altura });
    }
    return saida;
  }
}
