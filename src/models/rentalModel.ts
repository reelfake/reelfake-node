import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Rental extends BaseModel {
  public static async getRentalsCountForCustomer(customerId: number) {
    const rentalsCount = await Rental.count({
      where: {
        customerId,
      },
    });

    return rentalsCount;
  }

  public static async getRentalsCountProcessedByStaff(staffId: number) {
    const rentalsCount = await Rental.count({
      where: {
        staffId,
      },
    });

    return rentalsCount;
  }
}

Rental.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    inventoryId: {
      type: DataTypes.INTEGER,
      field: 'inventory_id',
    },
    customerId: {
      type: DataTypes.INTEGER,
      field: 'customer_id',
    },
    staffId: {
      type: DataTypes.INTEGER,
      field: 'staff_id',
    },
    rentalStartDate: {
      type: DataTypes.DATE,
      field: 'rental_start_date',
    },
    rentalEndDate: {
      type: DataTypes.DATE,
      field: 'rental_end_date',
    },
    returnDate: {
      type: DataTypes.DATE,
      field: 'return_date',
    },
    rentalDuration: {
      type: DataTypes.INTEGER,
      field: 'rental_duration',
    },
    delayedByDays: {
      type: DataTypes.INTEGER,
      field: 'delayed_by_days',
    },
    amountPaid: {
      type: DataTypes.NUMBER({ scale: 2 }),
      field: 'amount_paid',
    },
    discountAmount: {
      type: DataTypes.NUMBER({ scale: 2 }),
      field: 'discount_amount',
    },
    paymentDate: {
      type: DataTypes.DATE,
      field: 'payment_date',
    },
    rentalType: {
      type: DataTypes.ENUM('in-store', 'online'),
      field: 'rental_type',
    },
  },
  {
    sequelize,
    modelName: 'Rental',
    tableName: 'rental',
    timestamps: false,
  }
);

export default Rental;
