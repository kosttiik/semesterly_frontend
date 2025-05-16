import ExcelJS from 'exceljs';
import { ScheduleItem, Group } from '../types/schedule';
import { DAYS, TIME_SLOTS } from './constants';

interface ScheduleMap {
  [weekType: string]: {
    [day: number]: {
      [timeSlot: number]: {
        [groupId: string]: ScheduleItem[];
      };
    };
  };
}

interface ExcelCellValue {
  richText: Array<{
    text: string;
    font: {
      bold?: boolean;
      size: number;
      italic?: boolean;
      color?: { argb: string };
    };
  }>;
}

// Основные цвета для выделения групп
const GROUP_COLORS = [
  { hex: '#1677ff', argb: 'FF1677FF', light: 'FFE6F4FF' }, // синий
  { hex: '#f5222d', argb: 'FFF5222D', light: 'FFFBE6E6' }, // красный
  { hex: '#722ed1', argb: 'FF722ED1', light: 'FFF4E6FF' }, // фиолетовый
  { hex: '#52c41a', argb: 'FF52C41A', light: 'FFF0F9E6' }, // зеленый
  { hex: '#fa8c16', argb: 'FFFA8C16', light: 'FFFFF3E6' }, // оранжевый
] as const;

// Преобразование типов занятий с английского на русский
const translateActivityType = (actType: string): string =>
  ({
    lecture: 'лекция',
    lab: 'лаб. работа',
    laboratory: 'лаб. работа',
    practice: 'практ. работа',
    seminar: 'семинар',
    credit: 'зачёт',
    exam: 'экзамен',
    'лаб. работа': 'лаб. работа',
    'практ. работа': 'практ. работа',
  }[actType.toLowerCase()] || actType);

// Форматирование текста занятия для Excel
function formatLessonText(lesson: ScheduleItem): {
  name: string;
  type: string;
  teachers: string;
  location: string;
} {
  const discipline = lesson.disciplines[0];
  return {
    name: discipline?.fullName || 'Нет названия',
    type: translateActivityType(discipline?.actType || 'н/д'),
    teachers: lesson.teachers
      .map((t) => `${t.lastName} ${t.firstName[0]}.${t.middleName[0]}.`)
      .join(', '),
    location: lesson.audiences.map((a) => `${a.building}-${a.name}`).join(', '),
  };
}

export async function generateExcelWorkbook(
  scheduleMap: ScheduleMap,
  selectedGroups: string[],
  groups: Group[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Semesterly';
  workbook.lastModifiedBy = 'Semesterly';

  const worksheet = workbook.addWorksheet('Расписание', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    properties: { defaultRowHeight: 40 },
  });

  // Рассчитать оптимальные ширины столбцов для альбомного формата A4
  const a4Width = 297; // мм
  const dayColumnWidth = 4; // Уменьшено с 5
  const timeColumnWidth = 15; // Уменьшено с 18
  const availableWidth = a4Width - dayColumnWidth - timeColumnWidth - 2; // Поля по 2 мм
  const groupWidth = Math.floor(availableWidth / selectedGroups.length);

  // Константы стилей
  const borderStyle = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };

  const dayBottomBorderStyle = {
    ...borderStyle,
    bottom: { style: 'medium' as const },
  };

  // Конфигурация заголовков с колонкой дня
  const headers = [
    { name: 'День', color: 'FFF5F5F5', width: dayColumnWidth } as const,
    { name: 'Время', color: 'FFF5F5F5', width: timeColumnWidth } as const,
    ...selectedGroups.map((id, index) => ({
      name: groups.find((g) => g.uuid === id)?.name || 'Неизвестная группа',
      color: GROUP_COLORS[index % GROUP_COLORS.length].argb,
      width: groupWidth,
    })),
  ];

  // Установить ширину столбцов
  worksheet.columns = headers.map((h, index) => ({
    width: h.width / 2,
    style: {
      alignment: {
        wrapText: true,
        textRotation: index === 0 ? 90 : 0,
      },
    },
  }));

  // Добавить и стилизовать строку заголовка
  const headerRow = worksheet.addRow(headers.map((h) => h.name));
  headerRow.height = 35;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headers[colNumber - 1].color },
    };
    cell.font = {
      bold: true,
      size: 10,
      color: colNumber > 2 ? { argb: 'FFFFFFFF' } : undefined,
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
      textRotation: colNumber === 1 ? 90 : 0,
    };
    cell.border = borderStyle;
  });

  // Группировать дни для лучшей организации
  let dayStartRow = 2;

  DAYS.forEach((day, dayIndex) => {
    TIME_SLOTS.forEach((timeSlot, slotIndex) => {
      const rowData: Array<string | ExcelCellValue> = [day.name, timeSlot.time];

      selectedGroups.forEach((groupId) => {
        const numerator =
          scheduleMap.ch[day.id]?.[timeSlot.slot]?.[groupId]?.[0];
        const denominator =
          scheduleMap.zn[day.id]?.[timeSlot.slot]?.[groupId]?.[0];

        if (numerator || denominator) {
          const richTextParts = [];
          if (numerator && denominator) {
            const numLesson = formatLessonText(numerator);
            const denLesson = formatLessonText(denominator);
            richTextParts.push(
              {
                text: 'ЧС: ',
                font: { bold: true, size: 8.5, color: { argb: '99000000' } },
              },
              { text: `${numLesson.name}\n`, font: { size: 8.5 } },
              { text: `[${numLesson.type}] `, font: { italic: true, size: 8 } },
              {
                text: `${numLesson.teachers} • ${numLesson.location}\n`,
                font: { size: 8 },
              },
              {
                text: 'ЗН: ',
                font: { bold: true, size: 8.5, color: { argb: '99000000' } },
              },
              { text: `${denLesson.name}\n`, font: { size: 8.5 } },
              { text: `[${denLesson.type}] `, font: { italic: true, size: 8 } },
              {
                text: `${denLesson.teachers} • ${denLesson.location}`,
                font: { size: 8 },
              }
            );
          } else {
            const lesson = formatLessonText(numerator || denominator);
            const weekType = numerator ? 'ЧС' : 'ЗН';
            richTextParts.push(
              {
                text: `${weekType}: `,
                font: { bold: true, size: 8.5, color: { argb: '99000000' } },
              },
              { text: `${lesson.name}\n`, font: { size: 8.5 } },
              { text: `[${lesson.type}] `, font: { italic: true, size: 8 } },
              {
                text: `${lesson.teachers} • ${lesson.location}`,
                font: { size: 8 },
              }
            );
          }
          rowData.push({ richText: richTextParts } as ExcelCellValue);
        } else {
          rowData.push({
            richText: [{ text: '', font: { size: 8 } }],
          } as ExcelCellValue);
        }
      });

      const row = worksheet.addRow(rowData);

      // Стилизовать ячейки
      row.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          // Столбец дня
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
          cell.font = { size: 9, bold: true };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            textRotation: 90,
          };
          // Объединить ячейки дня по вертикали
          if (slotIndex === 0) {
            dayStartRow = row.number;
          }
          if (slotIndex === TIME_SLOTS.length - 1) {
            worksheet.mergeCells(dayStartRow, 1, row.number, 1);
          }
        } else if (colNumber === 2) {
          // Столбец времени
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' },
          };
          cell.font = { size: 8.5, bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          // Столбцы групп
          const groupColor =
            GROUP_COLORS[(colNumber - 3) % GROUP_COLORS.length];
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: groupColor.light },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
            shrinkToFit: true,
          };
        }
        // Применить более жирную нижнюю границу для последнего временного интервала каждого дня
        cell.border =
          slotIndex === TIME_SLOTS.length - 1 && dayIndex < DAYS.length - 1
            ? dayBottomBorderStyle
            : borderStyle;
      });

      // Получить максимальную длину текста из всех ячеек строки
      const maxTextLength = rowData.slice(2).reduce((max, cell) => {
        if (typeof cell === 'object' && 'richText' in cell) {
          const totalLength = cell.richText.reduce(
            (sum, part) => sum + part.text.length,
            0
          );
          return Math.max(max, totalLength);
        }
        return max;
      }, 0);

      const hasTwoLessons = rowData.slice(2).some((cell) => {
        if (typeof cell === 'object' && 'richText' in cell) {
          const text = cell.richText.map((part) => part.text).join('');
          return text.includes('ЧС:') && text.includes('ЗН:');
        }
        return false;
      });

      const hasAnyLesson = rowData.slice(2).some((cell) => {
        if (typeof cell === 'object' && 'richText' in cell) {
          return cell.richText.some(
            (part) => part.text.includes('ЧС:') || part.text.includes('ЗН:')
          );
        }
        return false;
      });

      // Более компактный расчет высоты строки
      let baseHeight = hasTwoLessons ? 65 : hasAnyLesson ? 32 : 12;

      // Добавить минимальную дополнительную высоту только при необходимости
      if (maxTextLength > 100) {
        baseHeight += 20;
      } else if (maxTextLength > 70) {
        baseHeight += 10;
      }

      row.height = baseHeight;
    });
  });

  // Оптимизация для печати на A4
  worksheet.pageSetup.orientation = 'portrait';
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 1;
  worksheet.pageSetup.paperSize = 9;
  worksheet.pageSetup.scale = 100;
  worksheet.pageSetup.margins = {
    left: 0.1,
    right: 0.1,
    top: 0.1,
    bottom: 0.1,
    header: 0,
    footer: 0,
  };

  // Установить метаданные
  workbook.created = new Date();
  workbook.modified = new Date();

  // Установить область печати
  worksheet.pageSetup.printArea = `A1:${String.fromCharCode(
    65 + headers.length - 1
  )}${worksheet.rowCount}`;

  return workbook;
}

export async function generateTeacherExcelWorkbook(
  teacherName: string,
  scheduleMap: {
    ch: { [day: number]: { [slot: number]: ScheduleItem[] } };
    zn: { [day: number]: { [slot: number]: ScheduleItem[] } };
    [key: string]: { [day: number]: { [slot: number]: ScheduleItem[] } };
  },
  groups: Group[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Semesterly';
  workbook.lastModifiedBy = 'Semesterly';

  const worksheet = workbook.addWorksheet('Расписание', {
    views: [{ state: 'frozen', ySplit: 2 }],
    properties: { defaultRowHeight: 40 },
  });

  worksheet.pageSetup.orientation = 'portrait';
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 1;
  worksheet.pageSetup.paperSize = 9;
  worksheet.pageSetup.scale = 100;
  worksheet.pageSetup.margins = {
    left: 0.1,
    right: 0.1,
    top: 0.1,
    bottom: 0.1,
    header: 0,
    footer: 0,
  };

  // Заголовок
  worksheet.mergeCells('A1', 'G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Расписание преподавателя: ${teacherName}`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  // Шапка таблицы
  const headers = [
    { name: 'День', width: 12 },
    { name: 'Время', width: 13 },
    { name: 'Неделя', width: 9 },
    { name: 'Дисциплина', width: 32 },
    { name: 'Тип', width: 12 },
    { name: 'Группы', width: 22 },
    { name: 'Аудитория', width: 18 },
  ];
  worksheet.columns = headers.map((h) => ({
    width: h.width,
    style: {
      alignment: { wrapText: true, vertical: 'middle', horizontal: 'center' },
    },
  }));

  const headerRow = worksheet.addRow(headers.map((h) => h.name));
  headerRow.font = { bold: true, size: 10 };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Сбор данных для строк
  const weekTypes = [
    { key: 'ch', label: 'ЧС', color: 'FFe6f7ff' },
    { key: 'zn', label: 'ЗН', color: 'FFf6ffed' },
  ];

  for (const day of DAYS) {
    for (const slot of TIME_SLOTS) {
      for (const week of weekTypes) {
        const lessons: ScheduleItem[] =
          scheduleMap[week.key as 'ch' | 'zn'][day.id]?.[slot.slot] || [];
        for (const lesson of lessons) {
          const discipline = lesson.disciplines[0];
          const groupNames = lesson.groups
            .map((g) => groups.find((gr) => gr.uuid === g.uuid)?.name || g.name)
            .join(', ');
          const location = lesson.audiences
            .map((a) => `${a.building}-${a.name}`)
            .join(', ');
          worksheet.addRow([
            day.name,
            slot.time,
            week.label,
            discipline?.fullName || 'Нет названия',
            translateActivityType(discipline?.actType || 'н/д'),
            groupNames,
            location,
          ]);
        }
      }
    }
  }

  // Стилизация строк
  for (let i = 3; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.height = 22;
    row.eachCell((cell, col) => {
      cell.font = { size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 4 ? 'left' : 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      // Цвет фона для недели
      if (col === 3) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: row.getCell(3).value === 'ЧС' ? 'FFe6f7ff' : 'FFf6ffed',
          },
        };
      }
    });
  }

  // Область печати
  worksheet.pageSetup.printArea = `A1:G${worksheet.rowCount}`;

  workbook.created = new Date();
  workbook.modified = new Date();

  return workbook;
}

export async function downloadExcel(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
