import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Filter, 
  X,
  Columns,
  CheckSquare,
  Square,
  Table as TableIcon,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';

// Filter definitions with available values
const FILTER_OPTIONS = {
  week: [
    { value: 'week1', label: 'Week 1' },
    { value: 'week2', label: 'Week 2' },
    { value: 'week3', label: 'Week 3' },
    { value: 'week4', label: 'Week 4' },
    { value: 'week5', label: 'Week 5' },
    { value: 'week6', label: 'Week 6' },
  ],
  retailer: [
    { value: 'retailer1', label: 'Retailer A' },
    { value: 'retailer2', label: 'Retailer B' },
    { value: 'retailer3', label: 'Retailer C' },
    { value: 'retailer4', label: 'Retailer D' },
  ],
  brand: [
    { value: 'brand1', label: 'Brand A' },
    { value: 'brand2', label: 'Brand B' },
    { value: 'brand3', label: 'Brand C' },
    { value: 'brand4', label: 'Brand D' },
  ],
  category: [
    { value: 'cat1', label: 'Category 1' },
    { value: 'cat2', label: 'Category 2' },
    { value: 'cat3', label: 'Category 3' },
    { value: 'cat4', label: 'Category 4' },
  ],
  countryOfOrigin: [
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'it', label: 'Italy' },
    { value: 'es', label: 'Spain' },
    { value: 'nl', label: 'Netherlands' },
  ],
  countryOfSale: [
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'it', label: 'Italy' },
    { value: 'es', label: 'Spain' },
    { value: 'nl', label: 'Netherlands' },
  ],
};

const FILTER_LABELS = {
  week: 'Week',
  retailer: 'Retailer',
  brand: 'Brand',
  category: 'Category',
  countryOfOrigin: 'Country of Origin',
  countryOfSale: 'Country of Sale',
};

// All available variables
const ALL_VARIABLES = [
  { id: 'skusOnPromotion', label: 'SKUs on promotion (%)', format: (v: number) => `${v}%` },
  { id: 'averageDiscount', label: 'Average discount (%)', format: (v: number) => `${v}%` },
  { id: 'averagePromoPricePerKg', label: 'Average promo price per kg (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'newPromotionsStarted', label: 'Number of new promotions started', format: (v: number) => v.toString() },
  { id: 'countOfSkus', label: 'Count of SKUs', format: (v: number) => v.toLocaleString() },
  { id: 'countOfUniqueOriginCountries', label: 'Count of unique origin countries', format: (v: number) => v.toString() },
  { id: 'averagePricePerPack', label: 'Average price per pack (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'averagePricePerKg', label: 'Average price per kg (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'minimumPricePerKg', label: 'Minimum price per kg (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'maximumPricePerKg', label: 'Maximum price per kg (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'medianPricePerKg', label: 'Median price per kg (EUR)', format: (v: number) => `€${v.toFixed(2)}` },
  { id: 'skuCountLocal', label: 'SKU count local', format: (v: number) => v.toLocaleString() },
  { id: 'skuCountImported', label: 'SKU count imported', format: (v: number) => v.toLocaleString() },
];

// Helper function to generate random number in range
const randomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Helper function to generate random integer in range
const randomIntInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate realistic value for a variable with seed-based variation
const generateVariableValue = (varId: string, seed?: string): number => {
  // Use seed to generate consistent but varied values for different columns
  let rand: number;
  if (seed) {
    const seedValue = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Use a more stable seed-based random
    const hash = seedValue * 9301 + 49297;
    rand = ((hash % 233280) / 233280);
  } else {
    rand = Math.random();
  }

  switch (varId) {
    case 'skusOnPromotion':
      // Percentage: 30-65% - more visible range
      return Number((30 + rand * 35).toFixed(1));
    
    case 'averageDiscount':
      // Percentage: 8-22% - more visible range
      return Number((8 + rand * 14).toFixed(1));
    
    case 'averagePromoPricePerKg':
      // Price in EUR: 1.80 - 3.20 - more visible range
      return Number((1.8 + rand * 1.4).toFixed(2));
    
    case 'newPromotionsStarted':
      // Count: 10-45 - more visible range
      return Math.floor(10 + rand * 35);
    
    case 'countOfSkus':
      // Count: 800-2800 - more visible range
      return Math.floor(800 + rand * 2000);
    
    case 'countOfUniqueOriginCountries':
      // Count: 4-10 - more visible range
      return Math.floor(4 + rand * 6);
    
    case 'averagePricePerPack':
      // Price in EUR: 3.00 - 7.50 - more visible range
      return Number((3.0 + rand * 4.5).toFixed(2));
    
    case 'averagePricePerKg':
      // Price in EUR: 2.00 - 3.60 - more visible range
      return Number((2.0 + rand * 1.6).toFixed(2));
    
    case 'minimumPricePerKg':
      // Price in EUR: 1.40 - 2.40 - more visible range
      return Number((1.4 + rand * 1.0).toFixed(2));
    
    case 'maximumPricePerKg':
      // Price in EUR: 2.80 - 4.20 - more visible range
      return Number((2.8 + rand * 1.4).toFixed(2));
    
    case 'medianPricePerKg':
      // Price in EUR: 1.90 - 3.00 - more visible range
      return Number((1.9 + rand * 1.1).toFixed(2));
    
    case 'skuCountLocal':
      // Count: 500-2000
      return Math.floor(500 + rand * 1500);
    
    case 'skuCountImported':
      // Count: 300-1500
      return Math.floor(300 + rand * 1200);
    
    default:
      return 0;
  }
};

// SKU List variables
const SKU_VARIABLES = [
  { id: 'skuId', label: 'SKU ID', isNumeric: false },
  { id: 'country', label: 'Country', isNumeric: false },
  { id: 'supermarket', label: 'Supermarket', isNumeric: false },
  { id: 'storeLocation', label: 'Store Location', isNumeric: false },
  { id: 'productGroup', label: 'Product Group', isNumeric: false },
  { id: 'productCategory', label: 'Product Category', isNumeric: false },
  { id: 'productName', label: 'Product Name', isNumeric: false },
  { id: 'brandName', label: 'Brand Name', isNumeric: false },
  { id: 'weightPerPack', label: 'Weight per Pack (g)', isNumeric: true },
  { id: 'price', label: 'Price (EUR)', isNumeric: true },
  { id: 'pricePerKg', label: 'Price per kg (EUR)', isNumeric: true },
  { id: 'coating', label: 'Coating', isNumeric: false },
  { id: 'typeOfProducts', label: 'Type of products', isNumeric: false },
  { id: 'typeOfCoating', label: 'Type of coating', isNumeric: false },
  { id: 'meatContent', label: 'Meat Content (%)', isNumeric: true },
  { id: 'countryOfOrigin', label: 'Country of Origin', isNumeric: false },
  { id: 'producerName', label: 'Producer Name', isNumeric: false },
  { id: 'producerId', label: 'Producer ID', isNumeric: false },
  { id: 'weekAdded', label: 'Week added', isNumeric: false },
  { id: 'weekLastSeen', label: 'Week last seen', isNumeric: false },
  { id: 'duration', label: 'Duration', isNumeric: true },
  { id: 'priceChangeOverPeriod', label: 'Price change over period', isNumeric: true },
  { id: 'shareOfTimeOnPromo', label: 'Share of time on promo', isNumeric: true },
];

// Generate mock SKU data
const generateMockSKUData = (
  filters: Record<string, any>,
  selectedVariables: string[]
): any[] => {
  const skus: any[] = [];
  const count = 50; // Generate 50 SKUs for demo
  
  for (let i = 0; i < count; i++) {
    const sku: any = {
      skuId: `SKU-${String(1000 + i).padStart(6, '0')}`,
      country: ['Germany', 'France', 'Italy', 'Spain', 'Netherlands'][Math.floor(Math.random() * 5)],
      supermarket: ['Retailer A', 'Retailer B', 'Retailer C', 'Retailer D'][Math.floor(Math.random() * 4)],
      storeLocation: `Store ${Math.floor(Math.random() * 100) + 1}`,
      productGroup: `Group ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`,
      productCategory: ['Category 1', 'Category 2', 'Category 3', 'Category 4'][Math.floor(Math.random() * 4)],
      productName: `Product ${i + 1}`,
      brandName: ['Brand A', 'Brand B', 'Brand C', 'Brand D'][Math.floor(Math.random() * 4)],
      weightPerPack: Math.floor(Math.random() * 500) + 100,
      price: Number((Math.random() * 10 + 2).toFixed(2)),
      pricePerKg: Number((Math.random() * 5 + 1.5).toFixed(2)),
      coating: ['Yes', 'No'][Math.floor(Math.random() * 2)],
      typeOfProducts: ['Type A', 'Type B', 'Type C'][Math.floor(Math.random() * 3)],
      typeOfCoating: ['Coating A', 'Coating B', 'None'][Math.floor(Math.random() * 3)],
      meatContent: Number((Math.random() * 50 + 30).toFixed(1)),
      countryOfOrigin: ['Germany', 'France', 'Italy', 'Spain', 'Netherlands'][Math.floor(Math.random() * 5)],
      producerName: `Producer ${String.fromCharCode(65 + Math.floor(Math.random() * 10))}`,
      producerId: `PROD-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
      weekAdded: `Week ${Math.floor(Math.random() * 6) + 1}`,
      weekLastSeen: `Week ${Math.floor(Math.random() * 6) + 1}`,
      duration: Math.floor(Math.random() * 20) + 1,
      priceChangeOverPeriod: Number((Math.random() * 2 - 1).toFixed(2)),
      shareOfTimeOnPromo: Number((Math.random() * 100).toFixed(1)),
      locality: ['local', 'imported'][Math.floor(Math.random() * 2)],
    };
    skus.push(sku);
  }
  
  // Apply filters
  let filtered = skus;
  
  // Apply SUPER filter (week window) if set
  if (filters.superFilterWeekStart !== undefined && filters.superFilterWeekStart !== null &&
      filters.superFilterWeekEnd !== undefined && filters.superFilterWeekEnd !== null) {
    filtered = filtered.filter(sku => {
      const weekAddedNum = parseInt(sku.weekAdded.replace('Week ', ''));
      const weekLastSeenNum = parseInt(sku.weekLastSeen.replace('Week ', ''));
      const startWeek = filters.superFilterWeekStart;
      const endWeek = filters.superFilterWeekEnd;
      // Include SKU if it has data within the week window
      return (weekAddedNum >= startWeek && weekAddedNum <= endWeek) ||
             (weekLastSeenNum >= startWeek && weekLastSeenNum <= endWeek) ||
             (weekAddedNum <= startWeek && weekLastSeenNum >= endWeek);
    });
  }
  
  if (filters.locality && filters.locality.length > 0) {
    filtered = filtered.filter(sku => filters.locality.includes(sku.locality));
  }
  
  if (filters.durationMin !== undefined && filters.durationMin !== '') {
    filtered = filtered.filter(sku => sku.duration >= Number(filters.durationMin));
  }
  
  if (filters.durationMax !== undefined && filters.durationMax !== '') {
    filtered = filtered.filter(sku => sku.duration <= Number(filters.durationMax));
  }
  
  return filtered;
};

// Mock data generator - generates data based on filters
const generateMockData = (
  selectedVariables: string[],
  filters: Record<string, string[]>,
  columnFilter: string | null
): Record<string, any> => {
  const result: Record<string, any> = {};

  if (columnFilter && filters[columnFilter] && filters[columnFilter].length > 0) {
    // If column filter is set, create columns for each selected value
    filters[columnFilter].forEach((value) => {
      const option = FILTER_OPTIONS[columnFilter as keyof typeof FILTER_OPTIONS]?.find(opt => opt.value === value);
      const columnName = option?.label || value;
      
      selectedVariables.forEach((varId) => {
        // Generate value with seed based on column value for consistency
        const generatedValue = generateVariableValue(varId, `${columnFilter}_${value}`);
        result[`${varId}_${value}`] = {
          variableId: varId,
          columnValue: value,
          columnLabel: columnName,
          value: generatedValue,
        };
      });
    });
  } else {
    // Single value for each variable
    selectedVariables.forEach((varId) => {
      const generatedValue = generateVariableValue(varId);
      result[varId] = {
        variableId: varId,
        value: generatedValue,
      };
    });
  }

  return result;
};

interface MultiSelectFilterProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  isColumn: boolean;
  onColumnToggle: () => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  isColumn,
  onColumnToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(options.map(opt => opt.value));
    }
  };

  const displayText = selectedValues.length === 0
    ? 'All'
    : selectedValues.length === 1
    ? options.find(opt => opt.value === selectedValues[0])?.label || selectedValues[0]
    : `${selectedValues.length} selected`;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between min-w-[150px]",
              selectedValues.length > 0 && "border-primary",
              isColumn && "bg-primary/10 border-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-medium">{label}:</span>
              <span className="text-muted-foreground">{displayText}</span>
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1.5 border-b">
              <span className="text-sm font-medium">{label}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSelectAll}
              >
                {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    onClick={() => handleToggle(option.value)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(option.value)}
                    />
                    <span className="text-sm flex-1">{option.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant={isColumn ? "default" : "outline"}
        size="sm"
        onClick={onColumnToggle}
        className="h-9"
        title={isColumn ? "Remove as Column" : "Set as Column"}
      >
        <Columns className="h-4 w-4" />
      </Button>
    </div>
  );
};

const PromotionDashboard: React.FC = () => {
  // Active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sku-list'>('dashboard');
  
  // Filter state: each filter has an array of selected values
  // By default, all values are selected for each filter
  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initialFilters: Record<string, string[]> = {};
    (Object.keys(FILTER_OPTIONS) as Array<keyof typeof FILTER_OPTIONS>).forEach((filterKey) => {
      initialFilters[filterKey] = FILTER_OPTIONS[filterKey].map(opt => opt.value);
    });
    return initialFilters;
  });

  // SKU List filters
  const [skuFilters, setSkuFilters] = useState<Record<string, any>>({
    week: [],
    retailer: [],
    brand: [],
    category: [],
    countryOfOrigin: [],
    countryOfSale: [],
    locality: [],
    durationMin: '',
    durationMax: '',
    superFilterWeekStart: undefined,
    superFilterWeekEnd: undefined,
  });

  // Which filter is set as Column
  const [columnFilter, setColumnFilter] = useState<string | null>(null);

  // Selected variables (all selected by default)
  const [selectedVariables, setSelectedVariables] = useState<string[]>(
    ALL_VARIABLES.map(v => v.id)
  );

  // Selected SKU variables (all selected by default)
  const [selectedSkuVariables, setSelectedSkuVariables] = useState<string[]>(
    SKU_VARIABLES.map(v => v.id)
  );

  // View mode: 'table' or 'chart'
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Percentage mode for data visualization
  const [showPercentages, setShowPercentages] = useState(false);

  // SKU sorting
  const [skuSortField, setSkuSortField] = useState<string | null>(null);
  const [skuSortDirection, setSkuSortDirection] = useState<'asc' | 'desc'>('asc');

  // Selected SKU for modal
  const [selectedSku, setSelectedSku] = useState<any | null>(null);

  // Toggle variable selection
  const toggleVariable = (variableId: string) => {
    if (selectedVariables.includes(variableId)) {
      setSelectedVariables(selectedVariables.filter(id => id !== variableId));
    } else {
      setSelectedVariables([...selectedVariables, variableId]);
    }
  };

  // Handle filter selection change
  const handleFilterChange = (filterKey: string, values: string[]) => {
    setFilters(prev => ({ ...prev, [filterKey]: values }));
    // If this filter was set as column and now has no values, remove it as column
    if (columnFilter === filterKey && values.length === 0) {
      setColumnFilter(null);
    }
  };

  // Toggle column filter
  const toggleColumnFilter = (filterKey: string) => {
    if (columnFilter === filterKey) {
      setColumnFilter(null);
    } else {
      // If another filter was column, remove it
      setColumnFilter(filterKey);
      // Ensure this filter has at least one value selected
      if (filters[filterKey].length === 0) {
        const allValues = FILTER_OPTIONS[filterKey as keyof typeof FILTER_OPTIONS]?.map(opt => opt.value) || [];
        setFilters(prev => ({ ...prev, [filterKey]: allValues }));
      }
    }
  };

  // Generate table data based on current state
  const tableData = useMemo(() => {
    return generateMockData(selectedVariables, filters, columnFilter);
  }, [selectedVariables, filters, columnFilter]);

  // Calculate percentages if needed
  const tableDataWithPercentages = useMemo(() => {
    if (!showPercentages || !columnFilter || !filters[columnFilter] || filters[columnFilter].length === 0) {
      return tableData;
    }

    const result: Record<string, any> = { ...tableData };
    
    // For each variable, calculate percentages by column
    selectedVariables.forEach((variableId) => {
      const values: number[] = [];
      
      // Collect all values for this variable
      filters[columnFilter].forEach((value) => {
        const dataKey = `${variableId}_${value}`;
        const data = tableData[dataKey];
        if (data && typeof data.value === 'number') {
          values.push(data.value);
        }
      });

      if (values.length === 0) return;

      // Calculate sum for percentage calculation
      const sum = values.reduce((a, b) => a + b, 0);
      const defaultPercentage = sum === 0 ? 100 : 100; // Default to 100% if no column filter

      // Update each value with percentage
      filters[columnFilter].forEach((value) => {
        const dataKey = `${variableId}_${value}`;
        const data = tableData[dataKey];
        if (data && typeof data.value === 'number') {
          const percentage = sum === 0 ? defaultPercentage : (data.value / sum) * 100;
          result[dataKey] = {
            ...data,
            value: percentage,
            originalValue: data.value,
          };
        }
      });
    });

    return result;
  }, [tableData, showPercentages, columnFilter, filters, selectedVariables]);

  // Generate SKU data
  const skuData = useMemo(() => {
    return generateMockSKUData(skuFilters, selectedSkuVariables);
  }, [skuFilters, selectedSkuVariables]);

  // Sort SKU data
  const sortedSkuData = useMemo(() => {
    if (!skuSortField) return skuData;

    const sorted = [...skuData];
    const variable = SKU_VARIABLES.find(v => v.id === skuSortField);
    
    if (!variable || !variable.isNumeric) return sorted;

    sorted.sort((a, b) => {
      const aVal = a[skuSortField];
      const bVal = b[skuSortField];
      
      if (typeof aVal !== 'number' || typeof bVal !== 'number') return 0;
      
      if (skuSortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return sorted;
  }, [skuData, skuSortField, skuSortDirection]);

  // Handle SKU sort
  const handleSkuSort = (field: string) => {
    const variable = SKU_VARIABLES.find(v => v.id === field);
    if (!variable || !variable.isNumeric) return;

    if (skuSortField === field) {
      setSkuSortDirection(skuSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSkuSortField(field);
      setSkuSortDirection('asc');
    }
  };

  // Get column headers for table
  const columnHeaders = useMemo(() => {
    if (columnFilter && filters[columnFilter] && filters[columnFilter].length > 0) {
      return filters[columnFilter].map(value => {
        const option = FILTER_OPTIONS[columnFilter as keyof typeof FILTER_OPTIONS]?.find(opt => opt.value === value);
        return {
          value,
          label: option?.label || value,
        };
      });
    }
    return null;
  }, [columnFilter, filters]);

  // Prepare chart data with normalization for better visualization
  const chartData = useMemo(() => {
    if (selectedVariables.length === 0) return [];

    // Normalization factors for different variable types to make them visible on the same scale
    // All values normalized to approximately 0-100 range for better visualization
    const normalizationFactors: Record<string, number> = {
      skusOnPromotion: 1, // Keep as is (30-65)
      averageDiscount: 3, // Multiply by 3 (24-66)
      averagePromoPricePerKg: 20, // Multiply by 20 (36-64)
      newPromotionsStarted: 2, // Multiply by 2 (20-90)
      countOfSkus: 0.05, // Divide by 20 (40-140)
      countOfUniqueOriginCountries: 10, // Multiply by 10 (40-100)
      averagePricePerPack: 10, // Multiply by 10 (30-75)
      averagePricePerKg: 20, // Multiply by 20 (40-72)
      minimumPricePerKg: 30, // Multiply by 30 (42-72)
      maximumPricePerKg: 20, // Multiply by 20 (56-84)
      medianPricePerKg: 25, // Multiply by 25 (47.5-75)
    };

    if (columnHeaders && columnHeaders.length > 0) {
      // Multiple columns mode - create data for each column
      return columnHeaders.map(header => {
        const dataPoint: Record<string, any> = {
          name: header.label,
        };
        
        selectedVariables.forEach(variableId => {
          const variable = ALL_VARIABLES.find(v => v.id === variableId);
          if (variable) {
            const dataKey = `${variableId}_${header.value}`;
            const data = tableData[dataKey];
            const value = data?.value || 0;
            // Extract numeric value and apply normalization for chart
            const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[€%,]/g, '')) || 0;
            const factor = normalizationFactors[variableId] || 1;
            dataPoint[variable.label] = numericValue * factor;
          }
        });
        
        return dataPoint;
      });
    } else {
      // Single column mode - create one data point
      const dataPoint: Record<string, any> = {
        name: 'All',
      };
      
      selectedVariables.forEach(variableId => {
        const variable = ALL_VARIABLES.find(v => v.id === variableId);
        if (variable) {
          const data = tableData[variableId];
          const value = data?.value || 0;
          const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[€%,]/g, '')) || 0;
          const factor = normalizationFactors[variableId] || 1;
          dataPoint[variable.label] = numericValue * factor;
        }
      });
      
      return [dataPoint];
    }
  }, [selectedVariables, tableData, columnHeaders]);

  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    // Modern, vibrant color palette with gradients
    const colors = [
      '#3B82F6', // Vibrant Blue
      '#10B981', // Emerald Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#6366F1', // Indigo
      '#84CC16', // Lime
    ];
    selectedVariables.forEach((variableId, index) => {
      const variable = ALL_VARIABLES.find(v => v.id === variableId);
      if (variable) {
        const colorIndex = index % colors.length;
        config[variable.label] = {
          label: variable.label,
          color: colors[colorIndex],
        };
      }
    });
    return config;
  }, [selectedVariables]);

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 sm:p-6">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Promotion Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Comprehensive view of promotion metrics and analytics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'dashboard' | 'sku-list')}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="sku-list">SKU list</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">

        {/* Filters Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
            <CardDescription>
              Select filter values and optionally set one as Column to create multiple columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(FILTER_OPTIONS) as Array<keyof typeof FILTER_OPTIONS>).map((filterKey) => (
                <MultiSelectFilter
                  key={filterKey}
                  label={FILTER_LABELS[filterKey]}
                  options={FILTER_OPTIONS[filterKey]}
                  selectedValues={filters[filterKey]}
                  onSelectionChange={(values) => handleFilterChange(filterKey, values)}
                  isColumn={columnFilter === filterKey}
                  onColumnToggle={() => toggleColumnFilter(filterKey)}
                />
              ))}
            </div>
            {columnFilter && (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="default" className="gap-2">
                  <Columns className="h-3 w-3" />
                  Column: {FILTER_LABELS[columnFilter as keyof typeof FILTER_LABELS]}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variables Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>
              Select which variables to display in the table
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {ALL_VARIABLES.map((variable) => {
                const isSelected = selectedVariables.includes(variable.id);
                return (
                  <Button
                    key={variable.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleVariable(variable.id)}
                    className="h-9"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 mr-2" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    {variable.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Data Table / Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle>Data Visualization</CardTitle>
                </div>
                <CardDescription className="mb-3">
                  {columnFilter
                    ? `Showing data with ${FILTER_LABELS[columnFilter as keyof typeof FILTER_LABELS]} as columns`
                    : 'Showing aggregated data'}
                </CardDescription>
                {/* Active Filters */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {(Object.keys(FILTER_OPTIONS) as Array<keyof typeof FILTER_OPTIONS>).map((filterKey) => {
                    const selectedValues = filters[filterKey];
                    const allValues = FILTER_OPTIONS[filterKey]?.map(opt => opt.value) || [];
                    const allSelected = selectedValues.length === allValues.length && 
                                      allValues.every(val => selectedValues.includes(val));
                    
                    // Don't show filter if all values are selected (default state)
                    if (allSelected && columnFilter !== filterKey) return null;
                    
                    const filterLabel = FILTER_LABELS[filterKey];
                    const isColumn = columnFilter === filterKey;
                    
                    return (
                      <div key={filterKey} className="flex items-center gap-1">
                        <Badge 
                          variant={isColumn ? "default" : "secondary"}
                          className="text-xs"
                        >
                          <Filter className="h-3 w-3 mr-1" />
                          {filterLabel}:
                        </Badge>
                        {selectedValues.length <= 3 ? (
                          selectedValues.map((value) => {
                            const option = FILTER_OPTIONS[filterKey]?.find(opt => opt.value === value);
                            return (
                              <Badge 
                                key={value} 
                                variant="outline"
                                className="text-xs"
                              >
                                {option?.label || value}
                              </Badge>
                            );
                          })
                        ) : (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span>
                                <Badge variant="outline" className="text-xs">
                                  {selectedValues.length} selected
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs" side="bottom" align="start">
                              <div className="space-y-2">
                                <p className="font-medium text-xs">Selected values:</p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedValues.map((value) => {
                                    const option = FILTER_OPTIONS[filterKey]?.find(opt => opt.value === value);
                                    return (
                                      <Badge 
                                        key={value} 
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {option?.label || value}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {columnFilter && filters[columnFilter] && filters[columnFilter].length > 0 && (
                  <div className="flex items-center space-x-2 mr-2">
                    <Checkbox
                      id="show-percentages"
                      checked={showPercentages}
                      onCheckedChange={(checked) => setShowPercentages(checked as boolean)}
                    />
                    <Label htmlFor="show-percentages" className="text-sm font-normal cursor-pointer">
                      Show percentages
                    </Label>
                  </div>
                )}
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="h-4 w-4 mr-2" />
                  Table
                </Button>
                <Button
                  variant={viewMode === 'chart' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('chart')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Chart
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedVariables.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No variables selected. Please select at least one variable to display.</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Variable</TableHead>
                      {columnHeaders ? (
                        columnHeaders.map((header) => (
                          <TableHead key={header.value} className="text-center">
                            {header.label}
                          </TableHead>
                        ))
                      ) : (
                        <TableHead className="text-center">Value</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedVariables.map((variableId) => {
                      const variable = ALL_VARIABLES.find(v => v.id === variableId);
                      if (!variable) return null;

                      if (columnHeaders) {
                        // Multiple columns mode
                        return (
                          <TableRow key={variableId}>
                            <TableCell className="font-medium">
                              {variable.label}
                            </TableCell>
                            {columnHeaders.map((header) => {
                              const dataKey = `${variableId}_${header.value}`;
                              const data = tableDataWithPercentages[dataKey];
                              const value = data?.value || 0;
                              const displayValue = showPercentages && columnFilter ? 
                                `${value.toFixed(1)}%` : 
                                variable.format(value);
                              return (
                                <TableCell key={header.value} className="text-center">
                                  {displayValue}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      } else {
                        // Single column mode
                        const data = tableDataWithPercentages[variableId];
                        const value = data?.value || 0;
                        const displayValue = showPercentages && columnFilter ? 
                          `${value.toFixed(1)}%` : 
                          variable.format(value);
                        return (
                          <TableRow key={variableId}>
                            <TableCell className="font-medium">
                              {variable.label}
                            </TableCell>
                            <TableCell className="text-center">
                              {displayValue}
                            </TableCell>
                          </TableRow>
                        );
                      }
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="w-full bg-gradient-to-br from-background to-muted/20 rounded-lg p-4">
                <ChartContainer config={chartConfig} className="h-[550px] w-full">
                  <BarChart 
                    data={chartData} 
                    margin={{ top: 30, right: 40, left: 20, bottom: 80 }}
                    barCategoryGap="12%"
                    barGap={8}
                  >
                    <defs>
                      {selectedVariables.map((variableId) => {
                        const variable = ALL_VARIABLES.find(v => v.id === variableId);
                        if (!variable) return null;
                        const color = chartConfig[variable.label]?.color || '#3B82F6';
                        const colorId = `gradient-${variableId}`;
                        return (
                          <linearGradient key={variableId} id={colorId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      opacity={0.2}
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="name" 
                      angle={columnHeaders && columnHeaders.length > 3 ? -45 : 0}
                      textAnchor={columnHeaders && columnHeaders.length > 3 ? "end" : "middle"}
                      height={columnHeaders && columnHeaders.length > 3 ? 100 : 60}
                      interval={0}
                      tick={{ 
                        fill: 'hsl(var(--foreground))', 
                        fontSize: 12,
                        fontWeight: 500
                      }}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ 
                        fill: 'hsl(var(--muted-foreground))', 
                        fontSize: 11,
                        fontWeight: 400
                      }}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      label={{ 
                        value: 'Normalized Values', 
                        angle: -90, 
                        position: 'insideLeft', 
                        style: { 
                          textAnchor: 'middle',
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: 12,
                          fontWeight: 500
                        } 
                      }}
                    />
                    <ChartTooltip 
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        
                        // Custom tooltip to show original values
                        const normalizationFactors: Record<string, number> = {
                          skusOnPromotion: 1,
                          averageDiscount: 3,
                          averagePromoPricePerKg: 20,
                          newPromotionsStarted: 2,
                          countOfSkus: 0.05,
                          countOfUniqueOriginCountries: 10,
                          averagePricePerPack: 10,
                          averagePricePerKg: 20,
                          minimumPricePerKg: 30,
                          maximumPricePerKg: 20,
                          medianPricePerKg: 25,
                        };
                        
                        return (
                          <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm p-4 shadow-xl">
                            <p className="font-semibold text-sm mb-3 text-foreground">{label}</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {payload.map((entry: any, index: number) => {
                                const variable = ALL_VARIABLES.find(v => v.label === entry.name);
                                if (!variable) return null;
                                const factor = normalizationFactors[variable.id] || 1;
                                const originalValue = (entry.value as number) / factor;
                                return (
                                  <div key={index} className="flex items-center gap-3">
                                    <div 
                                      className="h-3.5 w-3.5 rounded-sm shadow-sm" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">{entry.name}</p>
                                      <p className="text-sm font-semibold text-foreground">
                                        {variable.format(originalValue)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }}
                      animationDuration={300}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '24px' }}
                      iconType="rect"
                      iconSize={12}
                      formatter={(value) => (
                        <span style={{ fontSize: '12px', color: 'hsl(var(--foreground))' }}>
                          {value}
                        </span>
                      )}
                    />
                    {selectedVariables.map((variableId) => {
                      const variable = ALL_VARIABLES.find(v => v.id === variableId);
                      if (!variable) return null;
                      const color = chartConfig[variable.label]?.color || '#3B82F6';
                      const gradientId = `gradient-${variableId}`;
                      return (
                        <Bar
                          key={variableId}
                          dataKey={variable.label}
                          fill={`url(#${gradientId})`}
                          radius={[8, 8, 0, 0]}
                          name={variable.label}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      );
                    })}
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="sku-list" className="space-y-6">
            {/* SKU List Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
                <CardDescription>
                  Filter SKU list by various criteria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <MultiSelectFilter
                    label="Week"
                    options={FILTER_OPTIONS.week}
                    selectedValues={skuFilters.week || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, week: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <MultiSelectFilter
                    label="Retailer"
                    options={FILTER_OPTIONS.retailer}
                    selectedValues={skuFilters.retailer || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, retailer: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <MultiSelectFilter
                    label="Brand"
                    options={FILTER_OPTIONS.brand}
                    selectedValues={skuFilters.brand || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, brand: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <MultiSelectFilter
                    label="Category"
                    options={FILTER_OPTIONS.category}
                    selectedValues={skuFilters.category || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, category: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <MultiSelectFilter
                    label="Country of Origin"
                    options={FILTER_OPTIONS.countryOfOrigin}
                    selectedValues={skuFilters.countryOfOrigin || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, countryOfOrigin: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <MultiSelectFilter
                    label="Country of Sale"
                    options={FILTER_OPTIONS.countryOfSale}
                    selectedValues={skuFilters.countryOfSale || []}
                    onSelectionChange={(values) => setSkuFilters(prev => ({ ...prev, countryOfSale: values }))}
                    isColumn={false}
                    onColumnToggle={() => {}}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-between min-w-[150px]">
                        <span className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span className="font-medium">Locality:</span>
                          <span className="text-muted-foreground">
                            {skuFilters.locality && skuFilters.locality.length > 0 
                              ? skuFilters.locality.join(', ') 
                              : 'All'}
                          </span>
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2">
                      <div className="space-y-2">
                        <div className="px-2 py-1.5 border-b">
                          <span className="text-sm font-medium">Locality</span>
                        </div>
                        <div className="space-y-1">
                          {['local', 'imported'].map((option) => {
                            const isSelected = skuFilters.locality?.includes(option);
                            return (
                              <div
                                key={option}
                                className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                                onClick={() => {
                                  const current = skuFilters.locality || [];
                                  const newValues = isSelected
                                    ? current.filter(v => v !== option)
                                    : [...current, option];
                                  setSkuFilters(prev => ({ ...prev, locality: newValues }));
                                }}
                              >
                                <Checkbox checked={isSelected} />
                                <span className="text-sm capitalize">{option}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="duration-min" className="text-sm">Duration min:</Label>
                    <Input
                      id="duration-min"
                      type="number"
                      className="w-24"
                      value={skuFilters.durationMin || ''}
                      onChange={(e) => setSkuFilters(prev => ({ ...prev, durationMin: e.target.value }))}
                      placeholder="Min"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="duration-max" className="text-sm">Duration max:</Label>
                    <Input
                      id="duration-max"
                      type="number"
                      className="w-24"
                      value={skuFilters.durationMax || ''}
                      onChange={(e) => setSkuFilters(prev => ({ ...prev, durationMax: e.target.value }))}
                      placeholder="Max"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="super-filter-start" className="text-sm">SUPER filter:</Label>
                    <Select
                      value={skuFilters.superFilterWeekStart !== undefined && skuFilters.superFilterWeekStart !== null 
                        ? `week${skuFilters.superFilterWeekStart}` 
                        : ''}
                      onValueChange={(value) => {
                        const weekNum = value ? parseInt(value.replace('week', '')) : undefined;
                        setSkuFilters(prev => ({ ...prev, superFilterWeekStart: weekNum }));
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Start week" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPTIONS.week.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm">-</span>
                    <Select
                      value={skuFilters.superFilterWeekEnd !== undefined && skuFilters.superFilterWeekEnd !== null 
                        ? `week${skuFilters.superFilterWeekEnd}` 
                        : ''}
                      onValueChange={(value) => {
                        const weekNum = value ? parseInt(value.replace('week', '')) : undefined;
                        setSkuFilters(prev => ({ ...prev, superFilterWeekEnd: weekNum }));
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="End week" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPTIONS.week.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SKU Variables Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Variables</CardTitle>
                <CardDescription>
                  Select which variables to display in the SKU list
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {SKU_VARIABLES.map((variable) => {
                    const isSelected = selectedSkuVariables.includes(variable.id);
                    return (
                      <Button
                        key={variable.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSkuVariables(selectedSkuVariables.filter(id => id !== variable.id));
                          } else {
                            setSelectedSkuVariables([...selectedSkuVariables, variable.id]);
                          }
                        }}
                        className="h-9"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 mr-2" />
                        ) : (
                          <Square className="h-4 w-4 mr-2" />
                        )}
                        {variable.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* SKU List Table */}
            <Card>
              <CardHeader>
                <CardTitle>SKU List</CardTitle>
                <CardDescription>
                  List of SKUs with selected variables
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedSkuVariables.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No variables selected. Please select at least one variable to display.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedSkuVariables.map((variableId) => {
                            const variable = SKU_VARIABLES.find(v => v.id === variableId);
                            if (!variable) return null;
                            return (
                              <TableHead key={variableId} className="min-w-[120px]">
                                <div className="flex items-center gap-2">
                                  {variable.label}
                                  {variable.isNumeric && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleSkuSort(variableId)}
                                    >
                                      {skuSortField === variableId ? (
                                        skuSortDirection === 'asc' ? (
                                          <ArrowUp className="h-3 w-3" />
                                        ) : (
                                          <ArrowDown className="h-3 w-3" />
                                        )
                                      ) : (
                                        <ArrowUpDown className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSkuData.map((sku, index) => (
                          <TableRow 
                            key={sku.skuId || index}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedSku(sku)}
                          >
                            {selectedSkuVariables.map((variableId) => {
                              const variable = SKU_VARIABLES.find(v => v.id === variableId);
                              if (!variable) return null;
                              const value = sku[variableId];
                              let displayValue = value;
                              
                              if (variable.isNumeric && typeof value === 'number') {
                                if (variableId === 'price' || variableId === 'pricePerKg') {
                                  displayValue = `€${value.toFixed(2)}`;
                                } else if (variableId === 'meatContent' || variableId === 'shareOfTimeOnPromo') {
                                  displayValue = `${value.toFixed(1)}%`;
                                } else {
                                  displayValue = value.toLocaleString();
                                }
                              }
                              
                              return (
                                <TableCell key={variableId}>
                                  {displayValue}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* SKU Detail Modal */}
      <Dialog open={!!selectedSku} onOpenChange={(open) => !open && setSelectedSku(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SKU Details: {selectedSku?.skuId}</DialogTitle>
            <DialogDescription>
              Price chart and ingredients list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Price Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Price Chart</h3>
              <ChartContainer config={{ price: { label: 'Price (EUR)', color: '#3B82F6' } }} className="h-[300px] w-full">
                <LineChart data={[
                  { week: 'Week 1', price: selectedSku?.price || 0 },
                  { week: 'Week 2', price: (selectedSku?.price || 0) * 0.95 },
                  { week: 'Week 3', price: (selectedSku?.price || 0) * 1.05 },
                  { week: 'Week 4', price: (selectedSku?.price || 0) * 0.98 },
                  { week: 'Week 5', price: (selectedSku?.price || 0) * 1.02 },
                  { week: 'Week 6', price: selectedSku?.price || 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </div>
            
            {/* Ingredients List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">List of ingredients</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Meat ({selectedSku?.meatContent || 0}%), Water, Salt, Spices, Preservatives, 
                  Flavor enhancers, Antioxidants, Coating: {selectedSku?.coating || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromotionDashboard;
