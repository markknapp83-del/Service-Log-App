// useCustomFields hook tests following documented React Testing Library patterns
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCustomFields, useFieldChoices } from '../hooks/useCustomFields';
import { customFieldApi } from '../services/customFieldApi';
import { useToast } from '../hooks/useToast';
import { CustomFieldWithChoices, CustomFieldValue } from '../services/customFieldApi';
import { createMockApiResponse } from './setup';

// Mock dependencies following healthcare testing patterns
jest.mock('../services/customFieldApi');
jest.mock('../hooks/useToast');

const mockCustomFieldApi = jest.mocked(customFieldApi);
const mockUseToast = jest.mocked(useToast);

// Mock healthcare custom fields with choices
const mockCustomFields: CustomFieldWithChoices[] = [
  {
    id: 'field-1',
    fieldLabel: 'Patient Risk Level',
    fieldType: 'dropdown',
    fieldOrder: 1,
    isActive: true,
    choices: [
      { id: 'choice-1', fieldId: 'field-1', choiceText: 'Low Risk', choiceOrder: 1 },
      { id: 'choice-2', fieldId: 'field-1', choiceText: 'Medium Risk', choiceOrder: 2 },
      { id: 'choice-3', fieldId: 'field-1', choiceText: 'High Risk', choiceOrder: 3 },
    ],
  },
  {
    id: 'field-2',
    fieldLabel: 'Additional Notes',
    fieldType: 'text',
    fieldOrder: 2,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-3',
    fieldLabel: 'Patient Age',
    fieldType: 'number',
    fieldOrder: 3,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-4',
    fieldLabel: 'Requires Follow-up Call',
    fieldType: 'checkbox',
    fieldOrder: 4,
    isActive: true,
    choices: [],
  },
];

const mockCustomFieldValues: CustomFieldValue[] = [
  {
    id: 'value-1',
    patientEntryId: 'entry-123',
    fieldId: 'field-1',
    choiceId: 'choice-2',
  },
  {
    id: 'value-2',
    patientEntryId: 'entry-123',
    fieldId: 'field-2',
    textValue: 'Patient needs extra attention',
  },
  {
    id: 'value-3',
    patientEntryId: 'entry-123',
    fieldId: 'field-3',
    numberValue: 65,
  },
  {
    id: 'value-4',
    patientEntryId: 'entry-123',
    fieldId: 'field-4',
    checkboxValue: true,
  },
];

describe('useCustomFields Hook', () => {
  const mockShowToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
  });

  describe('Initial State and Loading', () => {
    it('initializes with correct default state', () => {
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      expect(result.current.fields).toEqual([]);
      expect(result.current.values).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('loads fields on mount by default', async () => {
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      const { result } = renderHook(() => useCustomFields());

      expect(result.current.isLoading).toBe(true);
      expect(mockCustomFieldApi.getActiveFields).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.fields).toEqual(mockCustomFields);
      });
    });

    it('does not load fields on mount when loadOnMount is false', () => {
      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      expect(result.current.isLoading).toBe(false);
      expect(mockCustomFieldApi.getActiveFields).not.toHaveBeenCalled();
    });
  });

  describe('refreshFields Function', () => {
    it('successfully loads custom fields', async () => {
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fields).toEqual(mockCustomFields);
      expect(result.current.error).toBeNull();
    });

    it('handles API failure when loading fields', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Failed to fetch fields', code: 'SERVER_ERROR' };
      
      mockCustomFieldApi.getActiveFields.mockResolvedValue(errorResponse);

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBe('Failed to fetch fields');
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Custom fields error: Failed to fetch fields',
      });
    });

    it('handles network error when loading fields', async () => {
      const networkError = new Error('Network request failed');
      mockCustomFieldApi.getActiveFields.mockRejectedValue(networkError);

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network request failed');
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Custom fields error: Network request failed',
      });
    });
  });

  describe('loadFieldValues Function', () => {
    it('successfully loads field values for patient entry', async () => {
      mockCustomFieldApi.getFieldValues.mockResolvedValue(
        createMockApiResponse(true, mockCustomFieldValues)
      );

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.loadFieldValues('entry-123');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.values).toEqual({
        'field-1': mockCustomFieldValues[0],
        'field-2': mockCustomFieldValues[1],
        'field-3': mockCustomFieldValues[2],
        'field-4': mockCustomFieldValues[3],
      });
      expect(result.current.error).toBeNull();
    });

    it('handles API failure when loading field values', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Patient entry not found', code: 'NOT_FOUND' };
      
      mockCustomFieldApi.getFieldValues.mockResolvedValue(errorResponse);

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.loadFieldValues('entry-123');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.values).toEqual({});
      expect(result.current.error).toBe('Patient entry not found');
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Field values error: Patient entry not found',
      });
    });

    it('automatically loads values when patientEntryId is provided', async () => {
      // First load fields
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      // Then load values
      mockCustomFieldApi.getFieldValues.mockResolvedValue(
        createMockApiResponse(true, mockCustomFieldValues)
      );

      renderHook(() => useCustomFields({ patientEntryId: 'entry-123' }));

      await waitFor(() => {
        expect(mockCustomFieldApi.getFieldValues).toHaveBeenCalledWith('entry-123');
      });
    });
  });

  describe('saveFieldValues Function', () => {
    beforeEach(() => {
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );
    });

    it('successfully saves field values with correct format conversion', async () => {
      const formValues = {
        'field-1': 'choice-2', // dropdown
        'field-2': 'Updated patient notes', // text
        'field-3': 70, // number
        'field-4': false, // checkbox
      };

      const expectedSaveData = [
        { patientEntryId: 'entry-456', fieldId: 'field-1', choiceId: 'choice-2' },
        { patientEntryId: 'entry-456', fieldId: 'field-2', textValue: 'Updated patient notes' },
        { patientEntryId: 'entry-456', fieldId: 'field-3', numberValue: 70 },
        { patientEntryId: 'entry-456', fieldId: 'field-4', checkboxValue: false },
      ];

      mockCustomFieldApi.saveFieldValues.mockResolvedValue(
        createMockApiResponse(true, mockCustomFieldValues)
      );

      const { result } = renderHook(() => useCustomFields());

      // Wait for fields to load first
      await waitFor(() => {
        expect(result.current.fields.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.saveFieldValues('entry-456', formValues);
      });

      expect(mockCustomFieldApi.saveFieldValues).toHaveBeenCalledWith('entry-456', expectedSaveData);
      expect(result.current.isLoading).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Custom field values saved successfully',
      });
    });

    it('filters out unknown fields when saving', async () => {
      const formValuesWithUnknown = {
        'field-1': 'choice-1',
        'unknown-field': 'should be filtered out',
        'field-2': 'Valid text',
      };

      const expectedSaveData = [
        { patientEntryId: 'entry-456', fieldId: 'field-1', choiceId: 'choice-1' },
        { patientEntryId: 'entry-456', fieldId: 'field-2', textValue: 'Valid text' },
      ];

      mockCustomFieldApi.saveFieldValues.mockResolvedValue(
        createMockApiResponse(true, [])
      );

      const { result } = renderHook(() => useCustomFields());

      await waitFor(() => {
        expect(result.current.fields.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.saveFieldValues('entry-456', formValuesWithUnknown);
      });

      expect(mockCustomFieldApi.saveFieldValues).toHaveBeenCalledWith('entry-456', expectedSaveData);
    });

    it('handles API failure when saving field values', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Validation failed', code: 'VALIDATION_ERROR' };
      
      mockCustomFieldApi.saveFieldValues.mockResolvedValue(errorResponse);

      const { result } = renderHook(() => useCustomFields());

      await waitFor(() => {
        expect(result.current.fields.length).toBeGreaterThan(0);
      });

      await expect(act(async () => {
        await result.current.saveFieldValues('entry-456', { 'field-1': 'choice-1' });
      })).rejects.toThrow('Validation failed');

      expect(result.current.error).toBe('Validation failed');
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Save failed: Validation failed',
      });
    });

    it('updates local values state after successful save', async () => {
      const savedValues = [
        { id: 'value-new-1', patientEntryId: 'entry-456', fieldId: 'field-1', choiceId: 'choice-1' },
        { id: 'value-new-2', patientEntryId: 'entry-456', fieldId: 'field-2', textValue: 'Saved text' },
      ];

      mockCustomFieldApi.saveFieldValues.mockResolvedValue(
        createMockApiResponse(true, savedValues)
      );

      const { result } = renderHook(() => useCustomFields());

      await waitFor(() => {
        expect(result.current.fields.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.saveFieldValues('entry-456', {
          'field-1': 'choice-1',
          'field-2': 'Saved text',
        });
      });

      expect(result.current.values).toEqual({
        'field-1': savedValues[0],
        'field-2': savedValues[1],
      });
    });
  });

  describe('clearValues Function', () => {
    it('clears all field values from state', () => {
      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      // Manually set some values
      act(() => {
        result.current.clearValues();
      });

      expect(result.current.values).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('handles generic errors appropriately', async () => {
      mockCustomFieldApi.getActiveFields.mockRejectedValue('Generic error');

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.error).toBe('Failed to load custom fields');
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Custom fields error: Failed to load custom fields',
      });
    });

    it('resets error state on successful operations', async () => {
      // First, cause an error
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Initial error', code: 'SERVER_ERROR' };
      mockCustomFieldApi.getActiveFields.mockResolvedValueOnce(errorResponse);

      const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.error).toBe('Initial error');

      // Then, succeed
      mockCustomFieldApi.getActiveFields.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      await act(async () => {
        await result.current.refreshFields();
      });

      expect(result.current.error).toBeNull();
    });
  });
});

describe('useFieldChoices Hook', () => {
  const mockChoices = [
    { id: 'choice-1', fieldId: 'field-1', choiceText: 'Option A', choiceOrder: 1 },
    { id: 'choice-2', fieldId: 'field-1', choiceText: 'Option B', choiceOrder: 2 },
    { id: 'choice-3', fieldId: 'field-1', choiceText: 'Option C', choiceOrder: 3 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useFieldChoices(''));

    expect(result.current.choices).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not load choices when fieldId is empty', () => {
    renderHook(() => useFieldChoices(''));

    expect(mockCustomFieldApi.getFieldChoices).not.toHaveBeenCalled();
  });

  it('loads choices when fieldId is provided', async () => {
    mockCustomFieldApi.getFieldChoices.mockResolvedValue(
      createMockApiResponse(true, mockChoices)
    );

    const { result } = renderHook(() => useFieldChoices('field-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.choices).toEqual(mockChoices);
      expect(result.current.error).toBeNull();
    });

    expect(mockCustomFieldApi.getFieldChoices).toHaveBeenCalledWith('field-1');
  });

  it('handles API failure when loading choices', async () => {
    const errorResponse = createMockApiResponse(false);
    errorResponse.error = { message: 'Field not found', code: 'NOT_FOUND' };
    
    mockCustomFieldApi.getFieldChoices.mockResolvedValue(errorResponse);

    const { result } = renderHook(() => useFieldChoices('field-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.choices).toEqual([]);
      expect(result.current.error).toBe('Field not found');
    });
  });

  it('handles network error when loading choices', async () => {
    const networkError = new Error('Network failure');
    mockCustomFieldApi.getFieldChoices.mockRejectedValue(networkError);

    const { result } = renderHook(() => useFieldChoices('field-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network failure');
    });
  });

  it('reloads choices when fieldId changes', async () => {
    mockCustomFieldApi.getFieldChoices
      .mockResolvedValueOnce(createMockApiResponse(true, [mockChoices[0]]))
      .mockResolvedValueOnce(createMockApiResponse(true, mockChoices));

    const { result, rerender } = renderHook(
      ({ fieldId }) => useFieldChoices(fieldId),
      { initialProps: { fieldId: 'field-1' } }
    );

    await waitFor(() => {
      expect(result.current.choices).toEqual([mockChoices[0]]);
    });

    rerender({ fieldId: 'field-2' });

    await waitFor(() => {
      expect(result.current.choices).toEqual(mockChoices);
    });

    expect(mockCustomFieldApi.getFieldChoices).toHaveBeenCalledTimes(2);
    expect(mockCustomFieldApi.getFieldChoices).toHaveBeenCalledWith('field-1');
    expect(mockCustomFieldApi.getFieldChoices).toHaveBeenCalledWith('field-2');
  });
});

// Performance and edge case tests
describe('useCustomFields Performance and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ showToast: jest.fn() });
  });

  it('handles concurrent API calls gracefully', async () => {
    let resolveFirst: () => void;
    let resolveSecond: () => void;

    const firstCall = new Promise<any>((resolve) => {
      resolveFirst = () => resolve(createMockApiResponse(true, mockCustomFields));
    });

    const secondCall = new Promise<any>((resolve) => {
      resolveSecond = () => resolve(createMockApiResponse(true, []));
    });

    mockCustomFieldApi.getActiveFields
      .mockReturnValueOnce(firstCall)
      .mockReturnValueOnce(secondCall);

    const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

    // Start two concurrent calls
    const promise1 = act(async () => {
      await result.current.refreshFields();
    });

    const promise2 = act(async () => {
      await result.current.refreshFields();
    });

    // Resolve second call first
    resolveSecond();
    await promise2;

    // Then resolve first call
    resolveFirst();
    await promise1;

    // Should use the result from the last resolved call
    expect(result.current.fields).toEqual([]);
  });

  it('handles large datasets efficiently', async () => {
    const largeFieldSet = Array.from({ length: 100 }, (_, i) => ({
      id: `field-${i}`,
      fieldLabel: `Field ${i}`,
      fieldType: 'text' as const,
      fieldOrder: i,
      isActive: true,
      choices: [],
    }));

    mockCustomFieldApi.getActiveFields.mockResolvedValue(
      createMockApiResponse(true, largeFieldSet)
    );

    const startTime = performance.now();
    
    const { result } = renderHook(() => useCustomFields({ loadOnMount: false }));

    await act(async () => {
      await result.current.refreshFields();
    });

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    expect(result.current.fields).toHaveLength(100);
    expect(processingTime).toBeLessThan(100); // Should process within 100ms
  });

  it('maintains referential stability for callback functions', () => {
    const { result, rerender } = renderHook(() => useCustomFields({ loadOnMount: false }));

    const initialRefreshFields = result.current.refreshFields;
    const initialLoadFieldValues = result.current.loadFieldValues;
    const initialSaveFieldValues = result.current.saveFieldValues;
    const initialClearValues = result.current.clearValues;

    rerender();

    expect(result.current.refreshFields).toBe(initialRefreshFields);
    expect(result.current.loadFieldValues).toBe(initialLoadFieldValues);
    expect(result.current.saveFieldValues).toBe(initialSaveFieldValues);
    expect(result.current.clearValues).toBe(initialClearValues);
  });
});