// IFC floor plans: IFC types to DXF layers and colours (spec §4). Pure: no DOM, no web-ifc.

// IFC_MEP: the distribution elements of IFC2X3 and their IFC4 subtypes. IfcSanitaryTerminal is a flow terminal
// too, but spec §4 puts it with the furniture.
const MEP = [
  'IfcDistributionElement', 'IfcDistributionFlowElement', 'IfcDistributionControlElement', 'IfcDistributionChamberElement',
  'IfcFlowSegment', 'IfcPipeSegment', 'IfcDuctSegment', 'IfcCableSegment', 'IfcCableCarrierSegment',
  'IfcFlowFitting', 'IfcPipeFitting', 'IfcDuctFitting', 'IfcCableFitting', 'IfcCableCarrierFitting', 'IfcJunctionBox',
  'IfcFlowTerminal', 'IfcAirTerminal', 'IfcAudioVisualAppliance', 'IfcCommunicationsAppliance', 'IfcElectricAppliance',
  'IfcFireSuppressionTerminal', 'IfcLamp', 'IfcLightFixture', 'IfcMedicalDevice', 'IfcOutlet', 'IfcSignal', 'IfcSpaceHeater',
  'IfcStackTerminal', 'IfcWasteTerminal', 'IfcLiquidTerminal',
  'IfcFlowController', 'IfcAirTerminalBox', 'IfcDamper', 'IfcElectricDistributionBoard', 'IfcElectricDistributionPoint',
  'IfcElectricTimeControl', 'IfcFlowMeter',
  'IfcProtectiveDevice', 'IfcSwitchingDevice', 'IfcValve',
  'IfcFlowMovingDevice', 'IfcCompressor', 'IfcFan', 'IfcPump',
  'IfcFlowStorageDevice', 'IfcElectricFlowStorageDevice', 'IfcTank',
  'IfcFlowTreatmentDevice', 'IfcDuctSilencer', 'IfcFilter', 'IfcInterceptor',
  'IfcEnergyConversionDevice', 'IfcAirToAirHeatRecovery', 'IfcBoiler', 'IfcBurner', 'IfcChiller', 'IfcCoil', 'IfcCondenser',
  'IfcCooledBeam', 'IfcCoolingTower', 'IfcElectricGenerator', 'IfcElectricMotor', 'IfcEngine', 'IfcEvaporativeCooler',
  'IfcEvaporator', 'IfcHeatExchanger', 'IfcHumidifier', 'IfcMotorConnection', 'IfcSolarDevice', 'IfcTransformer',
  'IfcTubeBundle', 'IfcUnitaryEquipment',
  'IfcActuator', 'IfcAlarm', 'IfcController', 'IfcFlowInstrument', 'IfcProtectiveDeviceTrippingUnit', 'IfcSensor',
  'IfcUnitaryControlElement',
];

// The layers in the order of spec §4 (also the legend's), each with its AutoCAD colour index and IFC types. IFC4's
// "standard case" subtypes go with their parent.
export const LAYERS = [
  { name: 'IFC_WALL', aci: 7, types: ['IfcWall', 'IfcWallStandardCase', 'IfcWallElementedCase'] },
  { name: 'IFC_DOOR', aci: 4, types: ['IfcDoor', 'IfcDoorStandardCase'] },
  { name: 'IFC_WINDOW', aci: 5, types: ['IfcWindow', 'IfcWindowStandardCase'] },
  { name: 'IFC_COLUMN', aci: 1, types: ['IfcColumn', 'IfcColumnStandardCase'] },
  { name: 'IFC_BEAM', aci: 8, types: ['IfcBeam', 'IfcBeamStandardCase', 'IfcMember', 'IfcMemberStandardCase'] },
  { name: 'IFC_SLAB', aci: 9, types: ['IfcSlab', 'IfcSlabStandardCase', 'IfcSlabElementedCase', 'IfcRoof', 'IfcCovering'] },
  { name: 'IFC_STAIR', aci: 3, types: ['IfcStair', 'IfcStairFlight', 'IfcRamp', 'IfcRampFlight'] },
  { name: 'IFC_RAILING', aci: 30, types: ['IfcRailing'] },
  { name: 'IFC_CURTAINWALL', aci: 140, types: ['IfcCurtainWall', 'IfcPlate', 'IfcPlateStandardCase'] },
  { name: 'IFC_FURNITURE', aci: 40, types: ['IfcFurnishingElement', 'IfcFurniture', 'IfcSystemFurnitureElement', 'IfcSanitaryTerminal'] },
  { name: 'IFC_MEP', aci: 6, types: MEP },
  { name: 'IFC_OTHER', aci: 8, types: ['IfcBuildingElementProxy'] },
  { name: 'IFC_SPACE', aci: 2, types: ['IfcSpace'] },
  { name: 'IFC_SPACE_TEXT', aci: 2, types: [] },
];
export const ACI = Object.fromEntries(LAYERS.map(l => [l.name, l.aci]));

// Never drawn, whatever their geometry.
const NEVER = new Set(['IFCOPENINGELEMENT', 'IFCOPENINGSTANDARDCASE', 'IFCANNOTATION', 'IFCGRID', 'IFCSITE', 'IFCVIRTUALELEMENT']);
const BY_TYPE = new Map(LAYERS.flatMap(l => l.types.map(t => [t.toUpperCase(), l.name])));

// The layer of an IFC type name (web-ifc gives 'IfcWall'; any case is accepted), or null when it is never drawn.
// Any other product with a body goes on IFC_OTHER.
export function layerOf(type) {
  const k = String(type).toUpperCase();
  if (NEVER.has(k)) return null;
  return BY_TYPE.get(k) || 'IFC_OTHER';
}

// The grid and level marker crosses some Revit exports carry as proxies: under 1 mm thick in Z, with no Body
// representation (spec §4). zSpan in metres.
export function isMarkerProxy({ type, zSpan, hasBody }) {
  return String(type).toUpperCase() === 'IFCBUILDINGELEMENTPROXY' && zSpan < 0.001 && !hasBody;
}
