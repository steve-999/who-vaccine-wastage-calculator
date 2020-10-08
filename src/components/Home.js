import React, { Component } from 'react';
import * as d3 from 'd3';
import data_6h_file from '../data/expected_wastage_rate_6hour.csv';
import data_28d_file from '../data/expected_wastage_rate_28day.csv';
import './Home.css';

function IsNumeric(input)
{
    // eslint-disable-next-line
    return (input - 0) == input && (''+input).trim().length > 0;
}

class Home extends Component {

    constructor(props) {
        super(props);

        this.state = {
            data_6hr: [],
            data_28day: [],
            dosesPerRecipient: '',
            numRecipients: '',
            numLocations: '',
            numDays: '',
            meanDosesAdministered: null,
            numDosesAdministered: null,
            numSessions: null,
            expected_wastage: null

        }
    }

    componentDidMount() {
        d3.csv(data_6h_file).then(data => this.setState({data_6hr: data}));
        d3.csv(data_28d_file).then(data => this.setState({data_28day: data}));
    }

    handleInputChange = (e) => {
        //console.log('handleInputChange', e.target.name, e.target.value);
        const name = e.target.name;
        const value = e.target.value;

        // if(localStorage) {
        //     localStorage.setItem(name, value);
        // }

        if (value.length > 0 && !IsNumeric(value)) {
            alert('Input values must be numeric');
            return;
        }

        this.setState({
            [name]: value
        }, () => this.calculateParams());
    }

    calculateParams = () => {
        //console.log('calculateParams called');
        const numSessions = this.state.numDays * this.state.numLocations;
        const numDosesAdministered = this.state.numRecipients * this.state.dosesPerRecipient;
        const meanDosesAdministered = numDosesAdministered / numSessions;

        this.setState({
            numSessions,
            numDosesAdministered,
            meanDosesAdministered
        }, () => {
            if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].every(key => this.state[key] && isFinite(this.state[key]))) {
                this.findExpectedWastage();
            }
        });
    }

    findRowIndex(data_array) {
        let idx = null;
        for (let i=0; i<data_array.length-1; i++) {
            if (data_array[i]['mean doses per period'] <= this.state.meanDosesAdministered
            && this.state.meanDosesAdministered <= data_array[i+1]['mean doses per period']) {
                idx = i;
            }
        }
        // console.log('idx', idx);
        // console.log(data_array[idx])
        // console.log(data_array[idx+1])
        return idx;
    }

    calcExpectedWastage = (data_array, idx, dosesPerVial) => {
        const exp_wastage1 = data_array[idx][dosesPerVial + ' dose vial'];
        const exp_wastage2 = data_array[idx+1][dosesPerVial + ' dose vial'];
        const mean_doses1 = data_array[idx]['mean doses per period']
        const mean_doses2 = data_array[idx+1]['mean doses per period']
        const calculated_mean_doses = this.state.meanDosesAdministered;
        const expected_wastage = parseFloat(exp_wastage1) 
                               + parseFloat((calculated_mean_doses - mean_doses1) / (mean_doses2 - mean_doses1)) 
                               * parseFloat(exp_wastage2 - exp_wastage1);
        // console.log('exp_wastage1', exp_wastage1);
        // console.log('exp_wastage2', exp_wastage2);
        // console.log('mean_doses1', mean_doses1);
        // console.log('mean_doses2', mean_doses2);
        // console.log('calculated_mean_doses', calculated_mean_doses);
        // console.log('exp_wastage2 - exp_wastage1', exp_wastage2 - exp_wastage1);
        // console.log('expected_wastage', expected_wastage);
        return expected_wastage;
    }

    findExpectedWastage = () => {
        const expected_wastage_obj = {
            '6hr': {},
            '28day': {}
        };
        for (let discardPeriod of ['6hr', '28day']) {
            //console.log('discardPeriod', discardPeriod);
            const data_array = this.state['data_' + String(discardPeriod)];
            const idx = this.findRowIndex(data_array);
            if (idx) {
                for (let dosesPerVial of [2, 5, 10, 20]) {
                    //console.log('dosesPerVial', dosesPerVial);
                    expected_wastage_obj[discardPeriod][dosesPerVial] = this.calcExpectedWastage(data_array, idx, dosesPerVial);
                }
            }
        }
        
        this.setState({
            expected_wastage: expected_wastage_obj
        });
    }

    renderResults = () => {
        if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].some(key => !this.state[key] || !isFinite(this.state[key]))) {
            //console.log('values have not been calculated yet, so do not render table rows')
            return;
        }
        if(!this.state.expected_wastage) {
            //console.log('expected_wastage values have not been calculated yet, so do not render table rows');
            return;       
        }

        const discardPeriods = ['6hr', '28day'];
        const fieldsArray = ['expected_wastage', 'mean_doses_wasted', 'mean_doses_consumed'];
        const dosesPerVialsArray = [2, 5, 10, 20];
        const JSX_array = [];
        for (let discardPeriod of discardPeriods) {
            for (let i=0; i<fieldsArray.length; i++) {
                let field = fieldsArray[i];
                const exp_wastage_cells = dosesPerVialsArray.map(dosesPerVial => {
                    const exp_wastage_val = this.state.expected_wastage[discardPeriod][dosesPerVial];
                    const exp_wastage_pc = 100 * exp_wastage_val;
                    const mean_doses_wasted = this.state.meanDosesAdministered * exp_wastage_val / (1 - exp_wastage_val);
                    const mean_doses_consumed = this.state.meanDosesAdministered + mean_doses_wasted;
                    const keyVal = Math.random();
                    switch(field) {
                        case 'expected_wastage':
                            return <td key={keyVal}>{isNaN(exp_wastage_pc) ? '-' : exp_wastage_pc.toFixed(1) + '%'}</td>
                        case 'mean_doses_wasted':
                            return <td key={keyVal}>{isNaN(mean_doses_wasted) ? '-' : mean_doses_wasted.toFixed(2)}</td>
                        case 'mean_doses_consumed':
                            return <td key={keyVal}>{isNaN(mean_doses_consumed) ? '-' : mean_doses_consumed.toFixed(2)}</td>
                        default:
                            return <td key={keyVal}>ValueError({field})</td>
                    }
                });
                let fieldText;
                switch(field) {
                    case 'expected_wastage':
                        fieldText = 'Expected wastage';
                        break;
                    case 'mean_doses_wasted':
                        fieldText = 'Mean doses wasted';
                        break;
                    case 'mean_doses_consumed':
                        fieldText = 'Mean doses consumed';
                        break;
                    default:
                        break;
                }
                let rowJSX;
                if (i === 0) {
                    rowJSX = (
                        <tr key={discardPeriod + ' ' + field}>
                            <td rowSpan="3">{discardPeriod === '6hr' ? '6 hours' : '28 days'}</td>
                            <td>{fieldText}</td>
                            { exp_wastage_cells }
                        </tr>
                    );
                }
                else {
                    rowJSX = (
                        <tr key={discardPeriod + ' ' + field}>
                            <td>{fieldText}</td>
                            { exp_wastage_cells }
                        </tr>
                    );       
                } 
                JSX_array.push(rowJSX)               
            }
        }
        return JSX_array;
    }

    renderResultsTable = () => {
        if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].some(key => !this.state[key] || !isFinite(this.state[key]))) {
            //console.log('values have not been calculated yet, so do not render table rows')
            return;
        }
        if(!this.state.expected_wastage) {
            //console.log('expected_wastage values have not been calculated yet, so do not render table rows');
            return;       
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <th rowSpan="2">Discard after</th>
                        <th rowSpan="2">Variable</th>
                        <th colSpan="4">Doses per vial</th>
                    </tr>
                    <tr>
                        <th>2</th>
                        <th>5</th>
                        <th>10</th>
                        <th>20</th>
                    </tr>                            
                    { this.renderResults() }
                </tbody>
            </table> 
        );
    }

    render() {
        return (
            <div className="home-container">
                <form className="input-form">
                    <div className="form-controls-grid-container">
                        <h3 className="grid-title">Vaccine & Campaign inputs</h3> 
                        <div className="grid-input-cell-1">
                            <label htmlFor="numRecipients">Number of recipients</label>
                            <input type="text" name="numRecipients" id="numRecipients" placeholder="e.g. 25000"
                                                        value={this.state.numRecipients} onChange={this.handleInputChange} />
                        </div>    
                        <div className="grid-input-cell-2"> 
                            <label htmlFor="dosesPerRecipient">Doses per recipient</label>
                            <input type="text" name="dosesPerRecipient" id="dosesPerRecipient" placeholder="e.g. 2"
                                                        value={this.state.dosesPerRecipient} onChange={this.handleInputChange} />
                        </div>    

                        <div className="grid-input-cell-3"> 
                            <label htmlFor="numLocations">Number of vaccination locations (or teams)</label>
                            <input type="text" name="numLocations" id="numLocations" placeholder="e.g. 200"
                                                        value={this.state.numLocations} onChange={this.handleInputChange} />
                        </div>   
                        <div className="grid-input-cell-4">     
                            <label htmlFor="numDays">Number of days</label>
                            <input type="text" name="numDays" id="numDays" placeholder="e.g. 10"
                                                    value={this.state.numDays} onChange={this.handleInputChange} />                                                                        
                        </div>  
                    </div>                                         
                </form>

                <div className="results-container">
                    <div className="calculated-params-container">
                        <table className="calculated-params-table">
                            <tbody>
                                <tr>
                                    <td width="70%">Number of sessions:</td>
                                    <td>{ this.state.numSessions && this.state.numSessions }</td>
                                </tr>
                                <tr>
                                    <td width="70%">Number of doses administered:</td>
                                    <td>{ this.state.numDosesAdministered && this.state.numDosesAdministered }</td>
                                </tr>
                                <tr>
                                    <td width="70%">Mean doses administered:</td>
                                    <td>{ this.state.meanDosesAdministered && isFinite(this.state.meanDosesAdministered) 
                                            ? this.state.meanDosesAdministered.toFixed(2) : '' }</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <br/>

                    { this.renderResultsTable() }
                </div>
            </div>
        );
    }
}

export default Home;