export const COMPLAINT_CATEGORIES = [
  { value: 'food_waste', label: 'Food waste' },
  { value: 'vegetable_fruit_peels', label: 'Vegetable & fruit peels' },
  { value: 'leaves', label: 'Leaves' },
  { value: 'paper', label: 'Paper' },
  { value: 'plastics', label: 'Plastics' },
  { value: 'glass', label: 'Glass' },
  { value: 'metals', label: 'Metals' },
  { value: 'e_waste', label: 'E-waste' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'batteries', label: 'Batteries' },
  { value: 'medical_waste', label: 'Medical waste' },
  { value: 'packaging_materials', label: 'Packaging materials' },
];

export const formatComplaintCategory = (value) => {
  const category = COMPLAINT_CATEGORIES.find((item) => item.value === value);
  if (category) {
    return category.label;
  }

  const rawType = value || 'unclassified';
  return rawType
    .toString()
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
