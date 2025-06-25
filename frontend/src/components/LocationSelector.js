// frontend/src/components/LocationSelector.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LocationSelector = ({ 
    selectedCountry, 
    selectedState, 
    selectedDistrict, 
    selectedCircle,
    onLocationChange,
    disabled = false 
}) => {
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [circles, setCircles] = useState([]);
    const [loading, setLoading] = useState(false);

    const backendIp = '127.0.0.1';
    const backendPort = '8000';

    // Fetch countries on component mount
    useEffect(() => {
        fetchCountries();
    }, []);

    // Fetch states when country changes
    useEffect(() => {
        if (selectedCountry) {
            fetchStates(selectedCountry);
        } else {
            setStates([]);
            setDistricts([]);
            setCircles([]);
        }
    }, [selectedCountry]);

    // Fetch districts when state changes
    useEffect(() => {
        if (selectedState) {
            fetchDistricts(selectedState);
        } else {
            setDistricts([]);
            setCircles([]);
        }
    }, [selectedState]);

    // Fetch circles when district changes
    useEffect(() => {
        if (selectedDistrict) {
            fetchCircles(selectedDistrict);
        } else {
            setCircles([]);
        }
    }, [selectedDistrict]);

    const fetchCountries = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`http://${backendIp}:${backendPort}/api/countries/`);
            setCountries(response.data);
        } catch (error) {
            console.error('Error fetching countries:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStates = async (countryId) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://${backendIp}:${backendPort}/api/states/?country_id=${countryId}`);
            setStates(response.data);
        } catch (error) {
            console.error('Error fetching states:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDistricts = async (stateId) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://${backendIp}:${backendPort}/api/districts/?state_id=${stateId}`);
            setDistricts(response.data);
        } catch (error) {
            console.error('Error fetching districts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCircles = async (districtId) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://${backendIp}:${backendPort}/api/circles/?district_id=${districtId}`);
            setCircles(response.data);
        } catch (error) {
            console.error('Error fetching circles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCountryChange = (e) => {
        const countryId = e.target.value;
        onLocationChange({
            country: countryId,
            state: '',
            district: '',
            circle: ''
        });
    };

    const handleStateChange = (e) => {
        const stateId = e.target.value;
        onLocationChange({
            country: selectedCountry,
            state: stateId,
            district: '',
            circle: ''
        });
    };

    const handleDistrictChange = (e) => {
        const districtId = e.target.value;
        onLocationChange({
            country: selectedCountry,
            state: selectedState,
            district: districtId,
            circle: ''
        });
    };

    const handleCircleChange = (e) => {
        const circleId = e.target.value;
        onLocationChange({
            country: selectedCountry,
            state: selectedState,
            district: selectedDistrict,
            circle: circleId
        });
    };

    return (
        <div>
            <div className="form-group">
                <label htmlFor="country" className="label">Country:</label>
                <select
                    id="country"
                    value={selectedCountry}
                    onChange={handleCountryChange}
                    className="input-field"
                    disabled={disabled || loading}
                    required
                >
                    <option value="">Select Country</option>
                    {countries.map(country => (
                        <option key={country.id} value={country.id}>
                            {country.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="state" className="label">State:</label>
                <select
                    id="state"
                    value={selectedState}
                    onChange={handleStateChange}
                    className="input-field"
                    disabled={disabled || loading || !selectedCountry}
                    required
                >
                    <option value="">Select State</option>
                    {states.map(state => (
                        <option key={state.id} value={state.id}>
                            {state.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="district" className="label">District:</label>
                <select
                    id="district"
                    value={selectedDistrict}
                    onChange={handleDistrictChange}
                    className="input-field"
                    disabled={disabled || loading || !selectedState}
                    required
                >
                    <option value="">Select District</option>
                    {districts.map(district => (
                        <option key={district.id} value={district.id}>
                            {district.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="circle" className="label">Circle:</label>
                <select
                    id="circle"
                    value={selectedCircle}
                    onChange={handleCircleChange}
                    className="input-field"
                    disabled={disabled || loading || !selectedDistrict}
                    required
                >
                    <option value="">Select Circle</option>
                    {circles.map(circle => (
                        <option key={circle.id} value={circle.id}>
                            {circle.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default LocationSelector;