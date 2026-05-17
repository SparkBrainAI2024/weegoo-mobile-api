# Vehicle GraphQL Examples

## Headers

- `authorization: Bearer <access_token>`
- `lang: EN` (or `NP`)

## Register Vehicle

```graphql
mutation RegisterVehicle($input: RegisterVehicleInput!) {
  registerVehicle(input: $input) {
    message
    success
    vehicle {
      _id
      driverId
      imageUrl
      vehicleType
      vehicleModel
      year
      numberPlate
      color
      createdAt
      updatedAt
    }
  }
}
```

### Variables

```json
{
  "input": {
    "imageUrl": "https://cdn.wegoo.com/vehicles/driver-123-car.png",
    "vehicleType": "CAR",
    "vehicleModel": "Honda City",
    "year": 2022,
    "numberPlate": "BA 2 CHA 1234",
    "color": "White"
  }
}
```

### Example Success Response

```json
{
  "data": {
    "registerVehicle": {
      "message": "Vehicle registered successfully.",
      "success": true,
      "vehicle": {
        "_id": "6821f5a8d5b1f6e03f3a8c11",
        "driverId": "6821ef68d5b1f6e03f3a8b9f",
        "imageUrl": "https://cdn.wegoo.com/vehicles/driver-123-car.png",
        "vehicleType": "CAR",
        "model": "Honda City",
        "year": 2022,
        "numberPlate": "BA 2 CHA 1234",
        "color": "White",
        "createdAt": "2026-05-12T10:15:04.493Z",
        "updatedAt": "2026-05-12T10:15:04.493Z"
      }
    }
  }
}
```

### Example Error (duplicate number plate)

```json
{
  "errors": [
    {
      "message": "Vehicle with this number plate already exists."
    }
  ],
  "data": null
}
```