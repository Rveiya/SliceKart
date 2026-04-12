import api from './api';
import { Address } from '../types';

export interface CreateAddressData {
    name: string;
    flat_no?: string;
    building_name?: string;
    area?: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    address_type?: 'Home' | 'Work' | 'Other';
    is_default?: boolean;
}

export interface UpdateAddressData extends Partial<CreateAddressData> { }

interface AddressesResponse {
    addresses: Address[];
}

interface AddressResponse {
    address: Address;
}

export const addressesService = {
    // Get all addresses for current user
    getAll: async (): Promise<Address[]> => {
        const response = await api.get<AddressesResponse>('/addresses');
        return response.data.addresses;
    },

    // Get address by ID
    getById: async (id: string): Promise<Address> => {
        const response = await api.get<AddressResponse>(`/addresses/${id}`);
        return response.data.address;
    },

    // Create a new address
    create: async (data: CreateAddressData): Promise<Address> => {
        const response = await api.post<AddressResponse>('/addresses', data);
        return response.data.address;
    },

    // Update an address
    update: async (id: string, data: UpdateAddressData): Promise<Address> => {
        const response = await api.put<AddressResponse>(`/addresses/${id}`, data);
        return response.data.address;
    },

    // Set address as default
    setDefault: async (id: string): Promise<Address> => {
        const response = await api.patch<AddressResponse>(`/addresses/${id}/default`);
        return response.data.address;
    },

    // Delete an address
    delete: async (id: string): Promise<void> => {
        await api.delete(`/addresses/${id}`);
    }
};

export default addressesService;
