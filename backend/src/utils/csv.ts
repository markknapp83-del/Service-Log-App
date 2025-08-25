// CSV generation utilities following Express.js documentation patterns
import { logger } from './logger';

/**
 * Escapes CSV field values and wraps in quotes if necessary
 */
export function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  
  const stringValue = String(value);
  
  // If the field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  // For healthcare data security, always quote string fields to prevent injection
  return `"${stringValue}"`;
}

/**
 * Converts an array of objects to CSV format with proper healthcare data handling
 */
export function arrayToCsv<T extends Record<string, any>>(
  data: T[],
  headers: Array<keyof T>,
  headerLabels?: string[]
): string {
  try {
    if (!data || data.length === 0) {
      return '';
    }

    // Use provided header labels or default to header keys
    const csvHeaders = headerLabels || headers.map(h => String(h));
    
    // Generate CSV header row
    const headerRow = csvHeaders.map(header => escapeCsvField(header)).join(',');
    
    // Generate CSV data rows
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        return escapeCsvField(value);
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
    
  } catch (error) {
    logger.error('CSV generation failed', { error, dataCount: data?.length });
    throw new Error(`Failed to generate CSV: ${error}`);
  }
}

/**
 * Sets appropriate headers for CSV file download
 */
export function setCsvHeaders(res: any, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * Sets appropriate headers for Excel file download (CSV format with Excel MIME type)
 */
export function setExcelHeaders(res: any, filename: string): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * Generates a timestamped filename for exports
 */
export function generateExportFilename(prefix: string, format: 'csv' | 'excel'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = format === 'excel' ? 'xlsx' : 'csv';
  return `${prefix}-${timestamp}.${extension}`;
}