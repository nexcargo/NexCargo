// NexCargo MOD-014 — Fleet Repository
// Owner: MOD-014 Fleet & Asset Registry Module
// CRUD operations for fleet, vehicle, driver, assignment, compliance, and backhaul data.

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Fleet row / API shapes
// ============================================================

interface FleetRow {
  id: string;
  fleet_id: string;
  name: string;
  region: string | null;
  ownerid: string;
  operational_status: string;
  created_at: string;
  updated_at: string;
}

export interface FleetApiShape {
  id: string;
  fleetId: string;
  name: string;
  region: string | null;
  ownerId: string;
  operationalStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Vehicle row / API shapes
// ============================================================

interface VehicleRow {
  id: string;
  vehicle_id: string;
  fleet_id: string;
  type: string;
  registration_number: string;
  capacity_weight_kg: number | string;
  capacity_volume_m3: number | string | null;
  availability_state: string;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_valid_until: string | null;
  licence_jurisdiction: string | null;
  licences_valid_nationwide: boolean;
  cross_border_permit_status: string;
  compliance_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleApiShape {
  id: string;
  vehicleId: string;
  fleetId: string;
  type: string;
  registrationNumber: string;
  capacityWeightKg: number;
  capacityVolumeM3: number | null;
  availabilityState: string;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceValidUntil: string | null;
  licenceJurisdiction: string | null;
  licencesValidNationwide: boolean;
  crossBorderPermitStatus: string;
  complianceNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Driver row / API shapes
// ============================================================

interface DriverRow {
  id: string;
  driver_id: string;
  fleet_id: string;
  platform_user_id: string | null;
  first_name: string;
  last_name: string;
  license_type: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  certification_status: string;
  availability_state: string;
  contact_number: string | null;
  compliance_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DriverApiShape {
  id: string;
  driverId: string;
  fleetId: string;
  platformUserId: string | null;
  firstName: string;
  lastName: string;
  licenseType: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: string | null;
  certificationStatus: string;
  availabilityState: string;
  contactNumber: string | null;
  complianceNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Assignment row / API shapes
// ============================================================

interface AssignmentRow {
  id: string;
  assignment_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  shipment_tracking_id: string;
  status: string;
  assigned_at: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentApiShape {
  id: string;
  assignmentId: string;
  vehicleId: string | null;
  driverId: string | null;
  shipmentTrackingId: string;
  status: string;
  assignedAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Compliance record row / API shapes
// ============================================================

interface ComplianceRecordRow {
  id: string;
  record_id: string;
  vehicle_id: string;
  corridor_id: string | null;
  country_code: string;
  permit_type: string;
  permit_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  temporary_permit: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRecordApiShape {
  id: string;
  recordId: string;
  vehicleId: string;
  corridorId: string | null;
  countryCode: string;
  permitType: string;
  permitNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  temporaryPermit: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Backhaul opportunity row / API shapes
// ============================================================

interface BackhaulOpportunityRow {
  id: string;
  opportunity_id: string;
  fleet_id: string;
  shipment_tracking_id: string;
  vehicle_id: string;
  current_location: string | null;
  destination: string | null;
  return_route: string | null;
  suggested_load_id: string | null;
  estimated_cost_recovery_pct: number | string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BackhaulOpportunityApiShape {
  id: string;
  opportunityId: string;
  fleetId: string;
  shipmentTrackingId: string;
  vehicleId: string;
  currentLocation: string | null;
  destination: string | null;
  returnRoute: string | null;
  suggestedLoadId: string | null;
  estimatedCostRecoveryPct: number | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Fleet Repository
// ============================================================

export class FleetRepository {
  private readonly schema = 'logistics_schema';

  // ---- Fleets ----

  async listFleets(ownerId?: string, limit = 50, offset = 0): Promise<FleetApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.fleets`)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ownerId) {
      query = query.eq('ownerid', ownerId);
    }

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list fleets: ${result.error.message}`);
    }

    return (result.data as FleetRow[]).map(r => this.toFleetShape(r));
  }

  async getFleetById(id: string): Promise<FleetApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.fleets`)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (result.error && !result.data) {
      throw new Error(`Failed to get fleet: ${result.error.message}`);
    }
    return result.data ? this.toFleetShape(result.data as FleetRow) : null;
  }

  async createFleet(params: {
    fleetId: string;
    name: string;
    region?: string;
    ownerId: string;
  }): Promise<FleetApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.fleets`)
      .insert({
        fleet_id: params.fleetId,
        name: params.name,
        region: params.region ?? null,
        ownerid: params.ownerId,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create fleet: ${result.error.message}`);
    }
    return this.toFleetShape(result.data as FleetRow);
  }

  async updateFleet(id: string, updates: { name?: string; region?: string; operationalStatus?: string }): Promise<FleetApiShape> {
    const supabase = await createClient();
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload['name'] = updates.name;
    if (updates.region !== undefined) payload['region'] = updates.region;
    if (updates.operationalStatus !== undefined) payload['operational_status'] = updates.operationalStatus;

    const result = await supabase
      .from(`${this.schema}.fleets`)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update fleet: ${result.error.message}`);
    }
    return this.toFleetShape(result.data as FleetRow);
  }

  // ---- Vehicles ----

  async listVehicles(fleetId?: string, type?: string, state?: string, limit = 50, offset = 0): Promise<VehicleApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.vehicles`)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fleetId) query = query.eq('fleet_id', fleetId);
    if (type) query = query.eq('type', type);
    if (state) query = query.eq('availability_state', state);

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list vehicles: ${result.error.message}`);
    }
    return (result.data as VehicleRow[]).map(r => this.toVehicleShape(r));
  }

  async getVehicleById(id: string): Promise<VehicleApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.vehicles`)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (result.error && !result.data) {
      throw new Error(`Failed to get vehicle: ${result.error.message}`);
    }
    return result.data ? this.toVehicleShape(result.data as VehicleRow) : null;
  }

  async createVehicle(params: {
    vehicleId: string;
    fleetId: string;
    type: string;
    registrationNumber: string;
    capacityWeightKg: number;
    capacityVolumeM3?: number | null;
    availabilityState?: string;
    insuranceProvider?: string | null;
    insurancePolicyNumber?: string | null;
    insuranceValidUntil?: string | null;
    licenceJurisdiction?: string | null;
    licencesValidNationwide?: boolean;
    crossBorderPermitStatus?: string;
    complianceNotes?: string | null;
    createdBy: string;
  }): Promise<VehicleApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.vehicles`)
      .insert({
        vehicle_id: params.vehicleId,
        fleet_id: params.fleetId,
        type: params.type,
        registration_number: params.registrationNumber,
        capacity_weight_kg: params.capacityWeightKg,
        capacity_volume_m3: params.capacityVolumeM3,
        availability_state: params.availabilityState ?? 'AVAILABLE',
        insurance_provider: params.insuranceProvider,
        insurance_policy_number: params.insurancePolicyNumber,
        insurance_valid_until: params.insuranceValidUntil,
        licence_jurisdiction: params.licenceJurisdiction,
        licences_valid_nationwide: params.licencesValidNationwide ?? false,
        cross_border_permit_status: params.crossBorderPermitStatus ?? 'NONE',
        compliance_notes: params.complianceNotes,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create vehicle: ${result.error.message}`);
    }
    return this.toVehicleShape(result.data as VehicleRow);
  }

  async updateVehicle(id: string, updates: {
    availabilityState?: string;
    crossBorderPermitStatus?: string;
    complianceNotes?: string;
  }): Promise<VehicleApiShape> {
    const supabase = await createClient();
    const payload: Record<string, unknown> = {};
    if (updates.availabilityState !== undefined) payload['availability_state'] = updates.availabilityState;
    if (updates.crossBorderPermitStatus !== undefined) payload['cross_border_permit_status'] = updates.crossBorderPermitStatus;
    if (updates.complianceNotes !== undefined) payload['compliance_notes'] = updates.complianceNotes;

    const result = await supabase
      .from(`${this.schema}.vehicles`)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update vehicle: ${result.error.message}`);
    }
    return this.toVehicleShape(result.data as VehicleRow);
  }

  // ---- Drivers ----

  async listDrivers(fleetId?: string, certificationStatus?: string, availabilityState?: string, limit = 50, offset = 0): Promise<DriverApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.drivers`)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fleetId) query = query.eq('fleet_id', fleetId);
    if (certificationStatus) query = query.eq('certification_status', certificationStatus);
    if (availabilityState) query = query.eq('availability_state', availabilityState);

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list drivers: ${result.error.message}`);
    }
    return (result.data as DriverRow[]).map(r => this.toDriverShape(r));
  }

  async getDriverById(id: string): Promise<DriverApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.drivers`)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (result.error && !result.data) {
      throw new Error(`Failed to get driver: ${result.error.message}`);
    }
    return result.data ? this.toDriverShape(result.data as DriverRow) : null;
  }

  async createDriver(params: {
    driverId: string;
    fleetId: string;
    platformUserId?: string | null;
    firstName: string;
    lastName: string;
    licenseType?: string | null;
    licenseNumber?: string | null;
    licenseExpiryDate?: string | null;
    certificationStatus?: string;
    availabilityState?: string;
    contactNumber?: string | null;
    complianceNotes?: string | null;
    createdBy: string;
  }): Promise<DriverApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.drivers`)
      .insert({
        driver_id: params.driverId,
        fleet_id: params.fleetId,
        platform_user_id: params.platformUserId,
        first_name: params.firstName,
        last_name: params.lastName,
        license_type: params.licenseType,
        license_number: params.licenseNumber,
        license_expiry_date: params.licenseExpiryDate,
        certification_status: params.certificationStatus ?? 'PENDING',
        availability_state: params.availabilityState ?? 'AVAILABLE',
        contact_number: params.contactNumber,
        compliance_notes: params.complianceNotes,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create driver: ${result.error.message}`);
    }
    return this.toDriverShape(result.data as DriverRow);
  }

  async updateDriver(id: string, updates: {
    certificationStatus?: string;
    availabilityState?: string;
    licenseExpiryDate?: string | null;
  }): Promise<DriverApiShape> {
    const supabase = await createClient();
    const payload: Record<string, unknown> = {};
    if (updates.certificationStatus !== undefined) payload['certification_status'] = updates.certificationStatus;
    if (updates.availabilityState !== undefined) payload['availability_state'] = updates.availabilityState;
    if (updates.licenseExpiryDate !== undefined) payload['license_expiry_date'] = updates.licenseExpiryDate;

    const result = await supabase
      .from(`${this.schema}.drivers`)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update driver: ${result.error.message}`);
    }
    return this.toDriverShape(result.data as DriverRow);
  }

  // ---- Asset Assignments ----

  async listAssignments(
    vehicleId?: string,
    driverId?: string,
    shipmentTrackingId?: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<AssignmentApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.asset_assignments`)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    if (driverId) query = query.eq('driver_id', driverId);
    if (shipmentTrackingId) query = query.eq('shipment_tracking_id', shipmentTrackingId);
    if (status) query = query.eq('status', status);

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list assignments: ${result.error.message}`);
    }
    return (result.data as AssignmentRow[]).map(r => this.toAssignmentShape(r));
  }

  async getAssignmentById(id: string): Promise<AssignmentApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.asset_assignments`)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (result.error && !result.data) {
      throw new Error(`Failed to get assignment: ${result.error.message}`);
    }
    return result.data ? this.toAssignmentShape(result.data as AssignmentRow) : null;
  }

  async createAssignment(params: {
    assignmentId: string;
    vehicleId?: string | null;
    driverId?: string | null;
    shipmentTrackingId: string;
    status?: string;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    notes?: string | null;
    createdBy: string;
  }): Promise<AssignmentApiShape> {
    // Validate at least one asset is present
    if (!params.vehicleId && !params.driverId) {
      throw new Error('At least one of vehicleId or driverId must be provided');
    }

    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.asset_assignments`)
      .insert({
        assignment_id: params.assignmentId,
        vehicle_id: params.vehicleId,
        driver_id: params.driverId,
        shipment_tracking_id: params.shipmentTrackingId,
        status: params.status ?? 'PLANNED',
        scheduled_start: params.scheduledStart,
        scheduled_end: params.scheduledEnd,
        notes: params.notes,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create assignment: ${result.error.message}`);
    }
    return this.toAssignmentShape(result.data as AssignmentRow);
  }

  async updateAssignment(id: string, updates: {
    status?: string;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    actualStart?: string | null;
    actualEnd?: string | null;
    notes?: string | null;
  }): Promise<AssignmentApiShape> {
    const supabase = await createClient();
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload['status'] = updates.status;
    if (updates.scheduledStart !== undefined) payload['scheduled_start'] = updates.scheduledStart;
    if (updates.scheduledEnd !== undefined) payload['scheduled_end'] = updates.scheduledEnd;
    if (updates.actualStart !== undefined) payload['actual_start'] = updates.actualStart;
    if (updates.actualEnd !== undefined) payload['actual_end'] = updates.actualEnd;
    if (updates.notes !== undefined) payload['notes'] = updates.notes;

    const result = await supabase
      .from(`${this.schema}.asset_assignments`)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update assignment: ${result.error.message}`);
    }
    return this.toAssignmentShape(result.data as AssignmentRow);
  }

  // ---- Cross-Border Compliance Records ----

  async listComplianceRecords(vehicleId?: string, countryCode?: string, status?: string, limit = 50, offset = 0): Promise<ComplianceRecordApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.cross_border_compliance_records`)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    if (countryCode) query = query.eq('country_code', countryCode);
    if (status) query = query.eq('status', status);

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list compliance records: ${result.error.message}`);
    }
    return (result.data as ComplianceRecordRow[]).map(r => this.toComplianceShape(r));
  }

  async createComplianceRecord(params: {
    recordId: string;
    vehicleId: string;
    corridorId?: string | null;
    countryCode: string;
    permitType: string;
    permitNumber?: string | null;
    issueDate?: string | null;
    expiryDate?: string | null;
    status?: string;
    temporaryPermit?: boolean;
    createdBy: string;
  }): Promise<ComplianceRecordApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.cross_border_compliance_records`)
      .insert({
        record_id: params.recordId,
        vehicle_id: params.vehicleId,
        corridor_id: params.corridorId,
        country_code: params.countryCode,
        permit_type: params.permitType,
        permit_number: params.permitNumber,
        issue_date: params.issueDate,
        expiry_date: params.expiryDate,
        status: params.status ?? 'VALID',
        temporary_permit: params.temporaryPermit ?? false,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create compliance record: ${result.error.message}`);
    }
    return this.toComplianceShape(result.data as ComplianceRecordRow);
  }

  // ---- Backhaul Opportunities ----

  async listBackhaulOpportunities(fleetId?: string, status?: string, limit = 50, offset = 0): Promise<BackhaulOpportunityApiShape[]> {
    const supabase = await createClient();
    let query = supabase
      .from(`${this.schema}.backhaul_opportunities`)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fleetId) query = query.eq('fleet_id', fleetId);
    if (status) query = query.eq('status', status);

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list backhaul opportunities: ${result.error.message}`);
    }
    return (result.data as BackhaulOpportunityRow[]).map(r => this.toBackhaulShape(r));
  }

  async createBackhaulOpportunity(params: {
    opportunityId: string;
    fleetId: string;
    shipmentTrackingId: string;
    vehicleId: string;
    currentLocation?: string | null;
    destination?: string | null;
    returnRoute?: string | null;
    suggestedLoadId?: string | null;
    estimatedCostRecoveryPct?: number | null;
    createdBy: string;
  }): Promise<BackhaulOpportunityApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.backhaul_opportunities`)
      .insert({
        opportunity_id: params.opportunityId,
        fleet_id: params.fleetId,
        shipment_tracking_id: params.shipmentTrackingId,
        vehicle_id: params.vehicleId,
        current_location: params.currentLocation,
        destination: params.destination,
        return_route: params.returnRoute,
        suggested_load_id: params.suggestedLoadId,
        estimated_cost_recovery_pct: params.estimatedCostRecoveryPct,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create backhaul opportunity: ${result.error.message}`);
    }
    return this.toBackhaulShape(result.data as BackhaulOpportunityRow);
  }

  async updateBackhaulStatus(id: string, status: string): Promise<BackhaulOpportunityApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.backhaul_opportunities`)
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update backhaul status: ${result.error.message}`);
    }
    return this.toBackhaulShape(result.data as BackhaulOpportunityRow);
  }

  // ---- Mappers ----

  private toFleetShape(row: FleetRow): FleetApiShape {
    return {
      id: row.id,
      fleetId: row.fleet_id,
      name: row.name,
      region: row.region,
      ownerId: row.ownerid,
      operationalStatus: row.operational_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toVehicleShape(row: VehicleRow): VehicleApiShape {
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      fleetId: row.fleet_id,
      type: row.type,
      registrationNumber: row.registration_number,
      capacityWeightKg: Number(row.capacity_weight_kg),
      capacityVolumeM3: row.capacity_volume_m3 ? Number(row.capacity_volume_m3) : null,
      availabilityState: row.availability_state,
      insuranceProvider: row.insurance_provider,
      insurancePolicyNumber: row.insurance_policy_number,
      insuranceValidUntil: row.insurance_valid_until,
      licenceJurisdiction: row.licence_jurisdiction,
      licencesValidNationwide: row.licences_valid_nationwide,
      crossBorderPermitStatus: row.cross_border_permit_status,
      complianceNotes: row.compliance_notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toDriverShape(row: DriverRow): DriverApiShape {
    return {
      id: row.id,
      driverId: row.driver_id,
      fleetId: row.fleet_id,
      platformUserId: row.platform_user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      licenseType: row.license_type,
      licenseNumber: row.license_number,
      licenseExpiryDate: row.license_expiry_date,
      certificationStatus: row.certification_status,
      availabilityState: row.availability_state,
      contactNumber: row.contact_number,
      complianceNotes: row.compliance_notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toAssignmentShape(row: AssignmentRow): AssignmentApiShape {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      shipmentTrackingId: row.shipment_tracking_id,
      status: row.status,
      assignedAt: row.assigned_at,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      actualStart: row.actual_start,
      actualEnd: row.actual_end,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toComplianceShape(row: ComplianceRecordRow): ComplianceRecordApiShape {
    return {
      id: row.id,
      recordId: row.record_id,
      vehicleId: row.vehicle_id,
      corridorId: row.corridor_id,
      countryCode: row.country_code,
      permitType: row.permit_type,
      permitNumber: row.permit_number,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      status: row.status,
      temporaryPermit: row.temporary_permit,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toBackhaulShape(row: BackhaulOpportunityRow): BackhaulOpportunityApiShape {
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      fleetId: row.fleet_id,
      shipmentTrackingId: row.shipment_tracking_id,
      vehicleId: row.vehicle_id,
      currentLocation: row.current_location,
      destination: row.destination,
      returnRoute: row.return_route,
      suggestedLoadId: row.suggested_load_id,
      estimatedCostRecoveryPct: row.estimated_cost_recovery_pct ? Number(row.estimated_cost_recovery_pct) : null,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
