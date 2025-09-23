export const ENVIRONMENTS = {
  dev: {
    name: 'Development',
    tokenUrl: process.env.DATA_GEN_DEV_TOKEN_URL || 'https://dev.example/token',
    clientId: process.env.DATA_GEN_DEV_CLIENT_ID || 'dev-client-id',
    clientSecret: process.env.DATA_GEN_DEV_CLIENT_SECRET || 'dev-client-secret',
    scope: process.env.DATA_GEN_DEV_SCOPE || 'api.default',
    multiTypeUrl: process.env.DATA_GEN_DEV_MULTI_URL || 'https://dev-multi.example/api/integration/upload/multiTypeRequest',
    partnerExternalRef: process.env.DATA_GEN_DEV_PARTNER_EXTREF || 'DEV_PARTNER_001',
    supplierExternalRef: process.env.DATA_GEN_DEV_SUPPLIER_EXTREF || 'DEV_SUPPLIER_001',
    orderListUrl: process.env.DATA_GEN_DEV_ORDERLIST_URL || 'https://dev-gateway.example/api/gateway/order/motor/list/'
  },
  test: {
    name: 'Test',
    tokenUrl: process.env.DATA_GEN_TEST_TOKEN_URL || 'https://test.example/token',
    clientId: process.env.DATA_GEN_TEST_CLIENT_ID || 'test-client-id',
    clientSecret: process.env.DATA_GEN_TEST_CLIENT_SECRET || 'test-client-secret',
    scope: process.env.DATA_GEN_TEST_SCOPE || 'api.default',
    multiTypeUrl: process.env.DATA_GEN_TEST_MULTI_URL || 'https://ig-weu-tst-httpconnector-functions.azurewebsites.net/api/integration/upload/multiTypeRequest',
    partnerExternalRef: process.env.DATA_GEN_TEST_PARTNER_EXTREF || 'TST_PARTNER_001',
    supplierExternalRef: process.env.DATA_GEN_TEST_SUPPLIER_EXTREF || 'TST_SUPPLIER_001',
    orderListUrl: process.env.DATA_GEN_TEST_ORDERLIST_URL || 'https://ig-weu-tst-gateway-proxy.azurewebsites.net/api/gateway/order/motor/list/'
  },
  uat: {
    name: 'UAT',
    tokenUrl: process.env.DATA_GEN_UAT_TOKEN_URL || 'https://uat.example/token',
    clientId: process.env.DATA_GEN_UAT_CLIENT_ID || 'uat-client-id',
    clientSecret: process.env.DATA_GEN_UAT_CLIENT_SECRET || 'uat-client-secret',
    scope: process.env.DATA_GEN_UAT_SCOPE || 'api.default',
    multiTypeUrl: process.env.DATA_GEN_UAT_MULTI_URL || 'https://uat-multi.example/api/integration/upload/multiTypeRequest',
    partnerExternalRef: process.env.DATA_GEN_UAT_PARTNER_EXTREF || 'UAT_PARTNER_001',
    supplierExternalRef: process.env.DATA_GEN_UAT_SUPPLIER_EXTREF || 'UAT_SUPPLIER_001',
    orderListUrl: process.env.DATA_GEN_UAT_ORDERLIST_URL || 'https://uat-gateway.example/api/gateway/order/motor/list/'
  }
};

// Optional per-feed credential overrides by environment.
// Populate via environment variables, do not hardcode secrets.
export const FEED_CREDENTIAL_OVERRIDES = {
  // Example for Test -> 3C
  test: {
    solvd: {
      clientId: process.env.DATA_GEN_TEST_SOLVD_CLIENT_ID,
      clientSecret: process.env.DATA_GEN_TEST_SOLVD_CLIENT_SECRET,
      scope: process.env.DATA_GEN_TEST_SOLVD_SCOPE || undefined,
      tokenUrl: process.env.DATA_GEN_TEST_SOLVD_TOKEN_URL || undefined,
    },
    threec: {
      clientId: process.env.DATA_GEN_TEST_THREEC_CLIENT_ID,
      clientSecret: process.env.DATA_GEN_TEST_THREEC_CLIENT_SECRET,
      scope: process.env.DATA_GEN_TEST_THREEC_SCOPE || undefined,
      tokenUrl: process.env.DATA_GEN_TEST_THREEC_TOKEN_URL || undefined,
    }
  },
  dev: {
    threec: {
      clientId: process.env.DATA_GEN_DEV_THREEC_CLIENT_ID,
      clientSecret: process.env.DATA_GEN_DEV_THREEC_CLIENT_SECRET,
      scope: process.env.DATA_GEN_DEV_THREEC_SCOPE || undefined,
      tokenUrl: process.env.DATA_GEN_DEV_THREEC_TOKEN_URL || undefined,
    }
  },
  uat: {
    threec: {
      clientId: process.env.DATA_GEN_UAT_THREEC_CLIENT_ID,
      clientSecret: process.env.DATA_GEN_UAT_THREEC_CLIENT_SECRET,
      scope: process.env.DATA_GEN_UAT_THREEC_SCOPE || undefined,
      tokenUrl: process.env.DATA_GEN_UAT_THREEC_TOKEN_URL || undefined,
    }
  }
};

// Preferred file suffix used for default source filenames by feed
export const FEED_FILE_SUFFIXES = {
  atUser: 'ATUser',
  threec: '3C',
  solvd: 'Solvd'
};

const ALL_REQUEST_TYPES = [
  'Order',
  'Progression',
  'Estimate',
  'OrderUpsert',
  'Supplier',
  'User'
];

export const FEEDS = {
  solvd: {
    name: 'Solvd Feed',
    requestTypes: ALL_REQUEST_TYPES
  },
  atUser: {
    name: 'AT user',
    requestTypes: ALL_REQUEST_TYPES
  },
  dsn: {
    name: 'DSN',
    requestTypes: ALL_REQUEST_TYPES
  },
  dat: {
    name: 'DAT',
    requestTypes: ALL_REQUEST_TYPES
  },
  dat2: {
    name: 'DAT 2.0',
    requestTypes: ALL_REQUEST_TYPES
  },
  allianz: {
    name: 'Allianz',
    requestTypes: ALL_REQUEST_TYPES
  },
  bmw_pronet: {
    name: 'BMW - Pronet',
    requestTypes: ALL_REQUEST_TYPES
  },
  zurich: {
    name: 'Zurich',
    requestTypes: ALL_REQUEST_TYPES
  },
  generali: {
    name: 'Generali',
    requestTypes: ALL_REQUEST_TYPES
  },
  cosmos: {
    name: 'Cosmos',
    requestTypes: ALL_REQUEST_TYPES
  },
  claimbees: {
    name: 'Claimbees',
    requestTypes: ALL_REQUEST_TYPES
  },
  softproject: {
    name: 'SoftProject',
    requestTypes: ALL_REQUEST_TYPES
  },
  threec: {
    name: '3C',
    requestTypes: ALL_REQUEST_TYPES
  },
  gdv: {
    name: 'GDV',
    requestTypes: ALL_REQUEST_TYPES
  },
  audatex: {
    name: 'Audatex',
    requestTypes: ALL_REQUEST_TYPES
  },
  enterprise: {
    name: 'Enterprise',
    requestTypes: ['Opportunity']
  }
};

export const TEMPLATES = {
  Solvd_Order: () => ({
    BatchReference: 'AutoBR_PLACEHOLDER',
    Signature: 'Signature',
    ErrorPolicy: 0,
    DuplicatePolicy: 0,
    payloads: []
  }),
};

export const REQUEST_TYPE_BUILDERS = {
  Order: [
    (ctx) => ({
      messageType: 10,
      payload: {
        ExternalReference: ctx.orderExternalRef,
        OrderItemDetails: [
          {
            OrderItemType: 0,
            OrderItemSubType: 0,
            ServiceType: 'ST01',
            SupplierId: ctx.supplierExternalRef,
            BookInDate: new Date().toISOString(),
            BookInTimeSlot: 0
          }
        ],
        NotificationDateTime: new Date().toISOString(),
        InsurancePolicy: {
          InsurerId: 'AutoGermanInsurerRef',
          PolicyNumber: ctx.policyNumber,
          InsurerExtRef: 'ext_ref_dup_001',
          PolicyStartDate: new Date(Date.now() - 86400000).toISOString(),
          PolicyEndDate: new Date(Date.now() + 86400000 * 300).toISOString(),
          InsuranceCoverType: 0,
          CustomerBoundToBodyShop: 1,
          ExcessType: 0
        },
        IncidentDetails: {
          IncidentDateTime: new Date().toISOString(),
          IncidentType: 0,
          IncidentCause: 'DEMC01',
          IncidentSubCause: 'DESC01',
          IncidentCircumstances: 'Generated by DataGen',
          IsCctvFootage: false,
          IsDashcamFootage: false,
          IsPropertyDamage: false,
          DriverDetail: { IsDriverAtFault: false },
          RoadConditions: { SpeedLimit: 70, WeatherConditions: 0 },
          JourneyDetail: { JourneyPurpose: 1, WhereJourneyBegan: 'Home', WhereJourneyIntendedToEnd: 'Office', HadTrailorAttached: false },
          IncidentLocation: { IsExactAddressKnown: false, ApproximateIncidentLocation: 'Generated' }
        },
        VehicleId: ctx.vehicleExternalRef,
        VehicleLocation: {
          AddressType: 0,
          AddressLine1: 'Auto Street 1',
          City: 'AutoCity',
          PostalCode: 'A1 1AA',
          CountryIsoNumber: 826
        },
        PolicyHolderId: ctx.policyHolderExternalRef,
        DriverId: ctx.licenceExternalRef,
        Files: ctx.fileExternalRefs,
      },
    }),
    (ctx) => ({
      messageType: 11,
      payload: {
        FirstName: ctx.firstName,
        LastName: ctx.lastName,
        DateOfBirth: '1980-01-01',
        Language: 'en-GB',
        Phones: [{ PhoneNumber: ctx.phoneNumber, PhoneType: 2, IsPreferred: true, CountryIsoNumber: 826 }],
        Emails: [{ EmailAddress: ctx.email, IsPreferred: true, EmailType: 0 }],
        Address: [{ AddressType: 1, AddressLine1: '1 Auto Way', City: 'London', PostalCode: 'E1 1AA', CountryIsoNumber: 826 }],
        ExternalReference: ctx.policyHolderExternalRef,
        IsDriver: true,
        EntityMessageType: 1
      },
    }),
    (ctx) => ({
      messageType: 12,
      payload: {
        Licence: { DateOfIssue: new Date(Date.now() - 86400000 * 3000).toISOString(), ExpiryDate: new Date(Date.now() + 86400000 * 2000).toISOString(), LicenceStatus: 0 },
        ExternalReference: ctx.licenceExternalRef,
        EntityMessageType: 1
      },
    }),
    (ctx) => ({
      messageType: 9,
      payload: {
        Vin: ctx.vin,
        Vrn: ctx.vrn,
        Make: 'Volkswagen',
        Model: 'Sharan',
        RegistrationDate: '2007-03-02T00:00:00Z',
        ExternalReference: ctx.vehicleExternalRef,
        EntityMessageType: 1
      },
    }),
  ],
  Progression: [
    (ctx) => ({
      messageType: 20,
      payload: {
        ExternalReference: ctx.orderExternalRef,
        Status: 'IN_PROGRESS',
        UpdatedDateTime: new Date().toISOString(),
        Notes: 'Auto progression update'
      }
    })
  ],
  Estimate: [
    (ctx) => ({
      messageType: 30,
      payload: {
        ExternalReference: ctx.orderExternalRef,
        EstimateExternalReference: `EXT_REF_EST_${Math.random().toString(36).slice(2,8).toUpperCase()}`,
        VehicleExternalReference: ctx.vehicleExternalRef,
        Lines: [
          { LineId: 1, Description: 'Labour', Cost: 120.50 },
          { LineId: 2, Description: 'Parts', Cost: 340.00 }
        ],
        Currency: 'GBP',
        Total: 460.50,
        CreatedDateTime: new Date().toISOString()
      }
    })
  ],
  OrderUpsert: [
    (ctx) => ({
      messageType: 40,
      payload: {
        ExternalReference: ctx.orderExternalRef,
        Patch: {
          CustomerBoundToBodyShop: true,
          AdditionalNotes: 'Upsert mutation applied'
        },
        PerformedDateTime: new Date().toISOString()
      }
    })
  ],
  Supplier: [
    (ctx) => ({
      messageType: 50,
      payload: {
        ExternalReference: ctx.supplierExternalRef,
        Name: 'Auto Supplier',
        Active: true,
        Address: { AddressLine1: '10 Supply Way', City: 'Birmingham', PostalCode: 'B1 1AA', CountryIsoNumber: 826 },
        Contact: { Email: ctx.email, Phone: ctx.phoneNumber }
      }
    })
  ],
  User: [
    (ctx) => ({
      messageType: 60,
      payload: {
        ExternalReference: ctx.policyHolderExternalRef,
        Email: ctx.email,
        FirstName: ctx.firstName,
        LastName: ctx.lastName,
        CreatedDateTime: new Date().toISOString(),
        Active: true,
        EntityMessageType: 1
      }
    })
  ]
};

export function listEnvironments(){
  return Object.entries(ENVIRONMENTS).map(([key, val]) => ({ key, name: val.name }));
}

export function listFeeds(){
  return Object.entries(FEEDS).map(([key, val]) => ({ key, name: val.name, requestTypes: val.requestTypes }));
}
